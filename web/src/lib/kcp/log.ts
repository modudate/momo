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

// 값이 긴/민감한 필드는 길이만 남긴다
const SECRET = new Set(["enc_data", "enc_info", "approval_key", "kcp_cert_info", "kcp_sign_data"]);
// 개인정보는 진단에 필요 없다 — 형태만 알아볼 수 있게 가린다.
//  (진단용 열쇠는 ordr_idxx 로 충분. 전화/이메일/카드번호를 평문 보관하면 안 된다)
const PII = new Set([
  "buyr_name",
  "buyr_mail",
  "buyr_tel1",
  "buyr_tel2",
  "card_mask_no",
  "shop_user_id",
]);

function maskPii(s: string): string {
  if (!s) return "";
  if (s.length <= 3) return s[0] + "*".repeat(s.length - 1);
  return s.slice(0, 2) + "*".repeat(Math.max(1, s.length - 4)) + s.slice(-2);
}

export function maskFields(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET.has(k)) {
      const s = String(v ?? "");
      out[k] = s ? `(길이 ${s.length})` : "(비어있음)";
    } else if (PII.has(k)) {
      out[k] = maskPii(String(v ?? ""));
    } else {
      out[k] = v;
    }
  }
  return out;
}
