import { getAdminClient } from "@/lib/supabase/admin";

// 결제 진단 로그 — 실패 원인을 눈으로 확인하기 위한 기록.
// 민감정보(enc_data 등)는 길이만 남기고 값은 저장하지 않는다.
export async function payLog(kind: string, ordrNo: string | null, payload: unknown) {
  try {
    const admin = getAdminClient();
    if (!admin) return;
    await admin.from("payment_logs").insert({ kind, ordr_no: ordrNo, payload });
  } catch {
    // 로그 실패가 결제를 막으면 안 된다
  }
}

// 값이 긴/민감한 필드는 마스킹
export function maskFields(obj: Record<string, unknown>): Record<string, unknown> {
  const SECRET = new Set(["enc_data", "enc_info", "approval_key", "kcp_cert_info", "kcp_sign_data"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET.has(k)) {
      const s = String(v ?? "");
      out[k] = s ? `(길이 ${s.length})` : "(비어있음)";
    } else {
      out[k] = v;
    }
  }
  return out;
}
