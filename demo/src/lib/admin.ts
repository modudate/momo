import { getServerUser } from "@/lib/supabase/server";

// 관리자 이메일 허용 목록 (쉼표 구분, 서버 전용)
const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

// 개발 중 임시 전체 공개 — 잠그려면 ADMIN_OPEN 을 false 로 (또는 제거)
const isAdminOpen = process.env.ADMIN_OPEN === "true";

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails.includes(email.toLowerCase());
}

// 관리자 접근 허용 여부 (ADMIN_OPEN=true 면 무제한 공개)
export async function isAdminAllowed(): Promise<boolean> {
  if (isAdminOpen) return true;
  const user = await getServerUser();
  return isAdminEmail(user?.email);
}
