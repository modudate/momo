import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/site";

// 예약에 필요한 개인정보가 다 있는지
function profileComplete(p: {
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: string | null;
}): boolean {
  return Boolean(p.name && p.phone && p.birth_year && p.gender);
}

// 소셜 로그인(구글 등) 콜백.
//  구글 인증이 끝나면 이 주소로 ?code=... 가 붙어 돌아온다.
//  그 code 를 세션(쿠키)으로 교환하고 원하던 페이지로 보낸다.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  // 돌아갈 곳 — 내부 경로만 허용 (오픈 리다이렉트 방지)
  const nextParam = url.searchParams.get("next") ?? "/mypage";
  const next =
    nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/mypage";

  if (code) {
    const supabase = await getServerClient();
    if (supabase) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // 개인정보(이름/전화/출생년도/성별)가 비어 있으면 먼저 입력받는다.
        //  (구글 최초 로그인은 이 정보가 없다 — 예약에 필요)
        const userId = data.user?.id;
        const admin = getAdminClient();
        if (userId && admin) {
          const { data: p } = await admin
            .from("profiles")
            .select("name,phone,birth_year,gender")
            .eq("id", userId)
            .maybeSingle<{
              name: string | null;
              phone: string | null;
              birth_year: number | null;
              gender: string | null;
            }>();
          if (!p || !profileComplete(p)) {
            // 입력을 마치면 원래 가려던 곳으로 이어지도록 next 를 넘긴다
            const q = next !== "/mypage" ? `&next=${encodeURIComponent(next)}` : "";
            return NextResponse.redirect(`${SITE_URL}/profile?welcome=1${q}`);
          }
        }
        return NextResponse.redirect(`${SITE_URL}${next}`);
      }
    }
  }

  // 실패 시 로그인 화면으로 (사유 표시)
  return NextResponse.redirect(`${SITE_URL}/login?error=oauth`);
}
