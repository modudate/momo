import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

// 관리자 접근 허용 여부 — 로그인 필수 + profiles.is_admin
// (이메일 허용목록 방식은 미인증 가입으로 탈취될 수 있어 제거, DB 플래그만 사용)
export async function isAdminAllowed(): Promise<boolean> {
  const user = await getServerUser();
  if (!user) return false;

  const admin = getAdminClient();
  if (!admin) return false;
  const { data } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle<{ is_admin: boolean }>();
  return data?.is_admin === true;
}
