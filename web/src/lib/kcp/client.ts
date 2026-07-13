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

// ---------- 거래 취소 ----------
//  · 전체취소 STSC / 부분취소 STPC
//  · 부분취소는 취소금액(mod_mny)과 남은금액(rem_mny)을 함께 보낸다
export async function cancel(params: {
  tno: string; // KCP 거래번호
  reason: string; // 취소 사유
  partial?: {
    modMny: number; // 이번에 취소할 금액
    remMny: number; // 취소 후 남는 금액
  };
}): Promise<KcpResult> {
  if (!isKcpConfigured) {
    return { ok: false, res_cd: "9998", res_msg: "KCP 키 미설정", raw: {} };
  }

  const mod_type = params.partial ? "STPC" : "STSC";
  const body: Record<string, unknown> = {
    site_cd: KCP.siteCd,
    kcp_cert_info: certInfo(),
    tno: params.tno,
    mod_type,
    mod_desc: params.reason,
    // site_cd ^ tno ^ mod_type 를 개인키로 서명
    kcp_sign_data: sign(`${KCP.siteCd}^${params.tno}^${mod_type}`),
  };

  if (params.partial) {
    body.mod_mny = String(params.partial.modMny);
    body.rem_mny = String(params.partial.remMny);
  }

  return post(KCP_API.cancel, body);
}
