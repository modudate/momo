import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, isServiceConfigured } from "./config";

// 서버 전용 admin 클라이언트 (service_role 키 → RLS 우회). API 라우트에서만 사용.
let _admin: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient | null {
  if (!isServiceConfigured) return null;
  if (!_admin) {
    _admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
