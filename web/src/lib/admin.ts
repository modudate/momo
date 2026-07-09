import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

// 관리자 이메일 허용 목록 (쉼표 구분, 서버 전용)
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}

// 관리자 접근 허용 여부 — 로그인 필수, ADMIN_EMAILS 또는 profiles.is_admin
export async function isAdminAllowed(): Promise<boolean> {
  const user = await getServerUser();
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;

  const admin = getAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  return data?.is_admin === true;
}
