// Supabase 환경변수 — 미설정 시 사이트는 mock 데이터로 폴백 동작
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// 서버 전용 (절대 클라이언트에 노출 금지)
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const isServiceConfigured = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
