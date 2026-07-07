import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from "./config";
import type { SupabaseClient } from "@supabase/supabase-js";

// 서버 컴포넌트 / 라우트 핸들러용 — 쿠키에서 세션을 읽는다.
export async function getServerClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // 서버 컴포넌트에서 set 호출 시 무시 (미들웨어가 갱신 담당)
        }
      },
    },
  });
}

export async function getServerUser() {
  const supa = await getServerClient();
  if (!supa) return null;
  const { data } = await supa.auth.getUser();
  return data.user ?? null;
}
