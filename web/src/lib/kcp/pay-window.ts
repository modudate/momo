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

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.KCP_Pay_Execute_Web) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("결제 모듈을 불러오지 못했어요."));
    };
    document.head.appendChild(s);
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

// 결제창을 띄우고, 승인까지 끝난 결과를 돌려준다
export async function openPayment(params: PayParams): Promise<PayResult> {
  await loadScript();

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

    try {
      window.KCP_Pay_Execute_Web?.(form);
    } catch {
      cleanup();
      resolve({ status: "failed", message: "결제창을 띄우지 못했어요." });
    }
  });
}

export const isPaymentEnabled = Boolean(SITE_CD);
export const isLivePayment = IS_LIVE;
