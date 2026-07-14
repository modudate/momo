import { NextResponse } from "next/server";
import { getServerClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

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
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${SITE_URL}${next}`);
      }
    }
  }

  // 실패 시 로그인 화면으로 (사유 표시)
  return NextResponse.redirect(`${SITE_URL}/login?error=oauth`);
}
