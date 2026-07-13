"use client";

// KCP 표준결제창 호출 (브라우저)
//  1) kcp_spay_hub.js 로드
//  2) 숨은 form 에 결제 정보를 채워 KCP_Pay_Execute_Web(form) 호출
//  3) 결제창이 끝나면 KCP 가 window.m_Completepayment 를 부르며 form 에 결과를 채워줌
//  4) res_cd === "0000" 이면 enc_data/enc_info 를 서버 승인 API 로 넘긴다

const IS_LIVE = process.env.NEXT_PUBLIC_KCP_MODE === "live";
const SCRIPT_URL = IS_LIVE
  ? "https://spay.kcp.co.kr/plugin/kcp_spay_hub.js"
  : "https://testspay.kcp.co.kr/plugin/kcp_spay_hub.js";

const SITE_CD = process.env.NEXT_PUBLIC_KCP_SITE_CD ?? "";

// 결제수단 비트 (12자리) — 신용카드
const PAY_METHOD_CARD = "100000000000";

export type PayParams = {
  ordrNo: string; // 주문번호 (그룹 id 기반)
  amount: number; // 결제 금액 (서버가 확정한 값)
  goodName: string; // 상품명
  buyerName: string;
  buyerTel: string;
  buyerEmail?: string;
};

export type PayResult =
  | { status: "paid"; tno: string; amount: number }
  | { status: "cancelled" } // 사용자가 결제창을 닫음
  | { status: "failed"; message: string };

declare global {
  interface Window {
    KCP_Pay_Execute_Web?: (form: HTMLFormElement) => void;
    m_Completepayment?: (formOrJson: unknown, closeEvent?: () => void) => void;
  }
}

let scriptPromise: Promise<void> | null = null;

// kcp_spay_hub.js 는 "로더"일 뿐이다.
// 이 스크립트가 onload 된 뒤에도 실제 결제창 함수(KCP_Pay_Execute_Web)는 아직 없고,
// 로더가 비동기로 붙이는 kcp_spay_cross_hub.js 등이 다 로드돼야 정의된다.
// → onload 만 믿고 호출하면 함수가 없어서 결제창이 안 뜬다. 반드시 함수가 생길 때까지 기다릴 것.
function waitForKcp(timeoutMs = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (typeof window.KCP_Pay_Execute_Web === "function") {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("결제 모듈 로딩이 지연되고 있어요. 잠시 후 다시 시도해 주세요."));
        return;
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (typeof window.KCP_Pay_Execute_Web === "function") return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    // 로더가 붙인 하위 스크립트까지 다 뜰 때까지 기다린다
    s.onload = () => waitForKcp().then(resolve, reject);
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("결제 모듈을 불러오지 못했어요."));
    };
    // 로더가 document.body 에 하위 스크립트를 붙이므로 body 가 있어야 함
    (document.body ?? document.head).appendChild(s);
  }).catch((e) => {
    scriptPromise = null; // 실패하면 다음 시도에서 다시 로드
    throw e;
  });

  return scriptPromise;
}

function field(form: HTMLFormElement, name: string, value = "") {
  const el = document.createElement("input");
  el.type = "hidden";
  el.name = name;
  el.value = value;
  form.appendChild(el);
  return el;
}

// 모바일 여부 — 모바일은 결제 흐름 자체가 다르다 (거래등록 → 결제창 페이지 이동)
export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent);
}

// ---------- 모바일 결제 ----------
// PC 처럼 iframe 결제창을 못 쓴다. 반드시:
//   1) 서버에서 KCP 거래등록 → approvalKey / PayUrl 수신
//   2) 그 값으로 결제창 주소에 폼 POST (페이지 전체가 이동)
//   3) 결제 후 KCP 가 우리 Ret_URL 로 폼 POST → 서버가 승인 처리 후 리다이렉트
// 이 함수는 페이지를 떠나므로 반환되지 않는다.
async function openPaymentMobile(params: PayParams): Promise<PayResult> {
  const res = await fetch("/api/payments/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ordrNo: params.ordrNo, goodName: params.goodName }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    return {
      status: "failed",
      message: data.message ?? "결제창을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.",
    };
  }

  const { approvalKey, payUrl } = (await res.json()) as {
    approvalKey: string;
    payUrl: string;
  };
  if (!approvalKey || !payUrl) {
    return { status: "failed", message: "결제창 정보를 받지 못했어요." };
  }

  // KCP 규격: PayUrl 의 마지막 경로를 encodingFilter.jsp 로 바꿔서 폼 POST
  const action = `${payUrl.substring(0, payUrl.lastIndexOf("/"))}/jsp/encodingFilter/encodingFilter.jsp`;

  const form = document.createElement("form");
  form.method = "post";
  form.action = action;
  form.acceptCharset = "euc-kr";
  form.style.display = "none";

  const add = (name: string, value: string) => {
    const el = document.createElement("input");
    el.type = "hidden";
    el.name = name;
    el.value = value;
    form.appendChild(el);
  };

  add("approval_key", approvalKey);
  add("PayUrl", payUrl);
  add("site_cd", SITE_CD);
  add("ordr_idxx", params.ordrNo);
  add("good_mny", String(params.amount));
  add("good_name", params.goodName.slice(0, 100));
  add("buyr_name", params.buyerName);
  add("buyr_tel2", params.buyerTel);
  add("buyr_mail", params.buyerEmail ?? "");
  add("pay_method", "CARD");
  add("currency", "WON");
  add("shop_name", "모두의 모임");
  add("escw_used", "N");
  add("res_cd", "");
  add("res_msg", "");

  document.body.appendChild(form);
  form.submit(); // 페이지가 결제창으로 넘어간다

  // 페이지가 이동하므로 여기로 돌아오지 않음
  return new Promise<PayResult>(() => {});
}

// 결제창을 띄우고, 승인까지 끝난 결과를 돌려준다
export async function openPayment(params: PayParams): Promise<PayResult> {
  // 모바일은 완전히 다른 흐름 (거래등록 → 페이지 이동)
  if (isMobileDevice()) {
    return openPaymentMobile(params);
  }

  try {
    await loadScript();
  } catch (e) {
    // 모듈 로딩 실패 → 오버레이가 계속 떠 있지 않도록 실패로 끝낸다
    return { status: "failed", message: (e as Error).message };
  }

  return new Promise<PayResult>((resolve) => {
    const form = document.createElement("form");
    form.name = "kcp_order_info";
    form.style.display = "none";
    // KCP 스크립트가 document.<formname> 으로 접근하는 경우가 있어 body 에 붙인다
    document.body.appendChild(form);

    // ---- 결제창에 넘기는 값 ----
    field(form, "site_cd", SITE_CD);
    field(form, "ordr_idxx", params.ordrNo);
    field(form, "good_mny", String(params.amount));
    field(form, "good_name", params.goodName.slice(0, 100));
    field(form, "buyr_name", params.buyerName);
    field(form, "buyr_tel2", params.buyerTel);
    field(form, "buyr_mail", params.buyerEmail ?? "");
    field(form, "pay_method", PAY_METHOD_CARD);
    field(form, "currency", "WON");
    field(form, "site_name", "모두의 모임");
    field(form, "quotaopt", "12"); // 할부 개월 옵션
    field(form, "shop_user_id", params.buyerTel);

    // ---- 결제창이 결과를 채워 넣는 자리 ----
    const resCd = field(form, "res_cd");
    const resMsg = field(form, "res_msg");
    const encData = field(form, "enc_data");
    const encInfo = field(form, "enc_info");
    const tranCd = field(form, "tran_cd");
    field(form, "ordr_chk");
    field(form, "use_pay_method");

    const cleanup = () => {
      window.m_Completepayment = undefined;
      form.remove();
    };

    // KCP 가 결제창 종료 시 호출
    window.m_Completepayment = async (_formOrJson: unknown, closeEvent?: () => void) => {
      try {
        closeEvent?.();
      } catch {
        /* 결제창 닫기 실패는 무시 */
      }

      const code = resCd.value;

      // 사용자가 취소했거나 인증 실패
      if (code !== "0000") {
        cleanup();
        // KCP 는 사용자가 창을 닫으면 별도 코드를 주거나 빈 값을 줌
        resolve(
          !code
            ? { status: "cancelled" }
            : { status: "failed", message: resMsg.value || `결제 인증 실패 (${code})` },
        );
        return;
      }

      // 인증 성공 → 서버에서 최종 승인
      try {
        const res = await fetch("/api/payments/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ordr_no: params.ordrNo,
            enc_data: encData.value,
            enc_info: encInfo.value,
            tran_cd: tranCd.value,
            pay_type: "PACA",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          tno?: string;
          amount?: number;
          error?: string;
          res_msg?: string;
        };
        cleanup();

        if (res.ok && data.ok) {
          resolve({ status: "paid", tno: data.tno ?? "", amount: data.amount ?? params.amount });
        } else {
          resolve({
            status: "failed",
            message:
              data.res_msg ??
              (data.error === "hold_expired"
                ? "자리 확보 시간이 지났어요. 다시 신청해 주세요."
                : "결제 승인에 실패했어요."),
          });
        }
      } catch {
        cleanup();
        resolve({ status: "failed", message: "결제 승인 중 오류가 발생했어요." });
      }
    };

    if (typeof window.KCP_Pay_Execute_Web !== "function") {
      cleanup();
      resolve({ status: "failed", message: "결제 모듈이 준비되지 않았어요. 새로고침 후 다시 시도해 주세요." });
      return;
    }

    try {
      window.KCP_Pay_Execute_Web(form);
    } catch (e) {
      cleanup();
      resolve({ status: "failed", message: `결제창을 띄우지 못했어요. (${(e as Error).message})` });
    }
  });
}

export const isPaymentEnabled = Boolean(SITE_CD);
export const isLivePayment = IS_LIVE;
