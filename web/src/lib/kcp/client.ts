import crypto from "node:crypto";
import { KCP, KCP_API, isKcpConfigured } from "./config";

// NHN KCP PG-API 클라이언트 (승인 / 취소)
//  · 인증서(kcp_cert_info)로 가맹점을 증명하고, 취소는 개인키 서명(kcp_sign_data)까지 필요.
//  · 서버 전용. 개인키는 절대 클라이언트로 나가지 않는다.

// 인증서를 KCP 규격대로 직렬화 (PEM 본문을 한 줄로)
function certInfo(): string {
  return KCP.cert.trim();
}

// 개인키로 서명 → base64
//  취소: site_cd ^ tno ^ mod_type
function sign(plain: string): string {
  const key = crypto.createPrivateKey(
    KCP.privateKeyPassword
      ? { key: KCP.privateKey, passphrase: KCP.privateKeyPassword }
      : KCP.privateKey,
  );
  return crypto.sign("sha256", Buffer.from(plain, "utf8"), key).toString("base64");
}

export type KcpResult = {
  ok: boolean;
  res_cd: string; // "0000" = 정상
  res_msg: string;
  tno?: string; // KCP 거래 고유번호
  amount?: number;
  raw: Record<string, unknown>;
};

async function post(url: string, body: Record<string, unknown>): Promise<KcpResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = { res_cd: "9999", res_msg: `응답 파싱 실패 (HTTP ${res.status})` };
  }

  const res_cd = String(data.res_cd ?? "9999");
  return {
    ok: res_cd === "0000",
    res_cd,
    res_msg: String(data.res_msg ?? ""),
    tno: data.tno ? String(data.tno) : undefined,
    amount: data.amount != null ? Number(data.amount) : undefined,
    raw: data,
  };
}

// ---------- 결제 승인 ----------
// 결제창 인증 결과(enc_data, enc_info)를 받아 최종 승인
export async function approve(params: {
  ordr_no: string; // 우리 주문번호
  ordr_mony: number; // 결제 금액
  pay_type: string; // PACA(신용카드) 등 — 결제창이 알려준 값
  enc_data: string;
  enc_info: string;
}): Promise<KcpResult> {
  if (!isKcpConfigured) {
    return { ok: false, res_cd: "9998", res_msg: "KCP 키 미설정", raw: {} };
  }
  return post(KCP_API.approve, {
    site_cd: KCP.siteCd,
    kcp_cert_info: certInfo(),
    tran_cd: "00100000", // 승인 요청 코드 (고정)
    ordr_no: params.ordr_no,
    ordr_mony: String(params.ordr_mony),
    pay_type: params.pay_type,
    enc_data: params.enc_data,
    enc_info: params.enc_info,
  });
}

// ---------- 거래등록 (모바일 전용) ----------
// 모바일 웹 결제창은 이걸 먼저 호출해 approvalKey / PayUrl 을 받아야 한다.
// (PC 는 kcp_spay_hub.js 만으로 되지만, 모바일은 거래등록이 필수)
export type RegisterResult =
  | { ok: true; approvalKey: string; payUrl: string; traceNo: string }
  | { ok: false; code: string; message: string };

export async function registerTrade(params: {
  ordr_idxx: string; // 주문번호
  good_mny: number; // 결제금액
  good_name: string; // 상품명
  ret_url: string; // 인증 결과를 돌려받을 우리 주소
  user_agent?: string;
}): Promise<RegisterResult> {
  if (!isKcpConfigured) {
    return { ok: false, code: "9998", message: "KCP 키 미설정" };
  }

  const res = await fetch(KCP_API.register, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({
      site_cd: KCP.siteCd,
      ordr_idxx: params.ordr_idxx,
      good_mny: String(params.good_mny),
      good_name: params.good_name.slice(0, 100),
      pay_method: "CARD", // 신용카드
      Ret_URL: params.ret_url,
      escw_used: "N", // 에스크로 미사용
      ...(params.user_agent ? { user_agent: params.user_agent } : {}),
    }),
  });

  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    return { ok: false, code: "9999", message: `응답 파싱 실패 (HTTP ${res.status})` };
  }

  const code = String(data.Code ?? data.res_cd ?? "9999");
  if (code !== "0000") {
    return { ok: false, code, message: String(data.Message ?? data.res_msg ?? "거래등록 실패") };
  }

  return {
    ok: true,
    approvalKey: String(data.approvalKey ?? ""),
    payUrl: String(data.PayUrl ?? ""),
    traceNo: String(data.traceNo ?? ""),
  };
}

// ---------- 거래 조회 ----------
// 거래번호(tno)로 실제 결제가 됐는지 확인한다.
// "승인은 났는데 우리 DB 저장이 실패한" 최악의 경우를 사람이 확인·복구할 때 쓴다.
export async function inquiry(params: { tno: string; payType?: string }): Promise<KcpResult> {
  if (!isKcpConfigured) {
    return { ok: false, res_cd: "9998", res_msg: "KCP 키 미설정", raw: {} };
  }
  const payType = params.payType ?? "PACA";
  return post(KCP_API.inquiry, {
    site_cd: KCP.siteCd,
    kcp_cert_info: certInfo(),
    tno: params.tno,
    pay_type: payType,
    kcp_sign_data: sign(`${KCP.siteCd}^${params.tno}^${payType}`),
  });
}

// ---------- 거래 취소 ----------
//  · 전체취소 STSC / 부분취소 STPC
//  · ⚠️ 부분취소가 한 번이라도 있었던 건은 전체취소(STSC)로 요청할 수 없다.
//       남은 잔액을 STPC 로 취소해야 한다. (KCP 거래취소 가이드)
//    → hasPriorPartial 이 true 면 잔액 전체를 취소하더라도 STPC 를 쓴다.
export async function cancel(params: {
  tno: string; // KCP 거래번호
  reason: string; // 취소 사유
  modMny: number; // 이번에 취소할 금액
  remMny: number; // 취소 후 남는 금액 (0 이면 잔액 전부 취소)
  hasPriorPartial: boolean; // 이 거래에 부분취소 이력이 있는가
}): Promise<KcpResult> {
  if (!isKcpConfigured) {
    return { ok: false, res_cd: "9998", res_msg: "KCP 키 미설정", raw: {} };
  }

  // 남는 금액이 없고 + 부분취소 이력도 없을 때만 전체취소 가능
  const isFullCancel = params.remMny === 0 && !params.hasPriorPartial;
  const mod_type = isFullCancel ? "STSC" : "STPC";

  const body: Record<string, unknown> = {
    site_cd: KCP.siteCd,
    kcp_cert_info: certInfo(),
    tno: params.tno,
    mod_type,
    mod_desc: params.reason,
    // 평문 site_cd ^ tno ^ mod_type 를 SHA256withRSA 로 서명 후 base64 (KCP 서명데이터 규격)
    kcp_sign_data: sign(`${KCP.siteCd}^${params.tno}^${mod_type}`),
  };

  if (mod_type === "STPC") {
    body.mod_mny = String(params.modMny);
    body.rem_mny = String(params.remMny);
  }

  return post(KCP_API.cancel, body);
}
