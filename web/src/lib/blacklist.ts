import { getAdminClient } from "@/lib/supabase/admin";

// 전화번호 정규화 (숫자만)
export const normPhone = (p?: string | null) => (p ?? "").replace(/[^0-9]/g, "");

// 블랙리스트 전화 → 메모 맵 (정규화 키)
export async function getBlacklistMap(): Promise<Map<string, string>> {
  const admin = getAdminClient();
  if (!admin) return new Map();
  const { data } = await admin
    .from("blacklist")
    .select("phone_norm,memo")
    .returns<{ phone_norm: string | null; memo: string | null }[]>();
  const map = new Map<string, string>();
  (data ?? []).forEach((r) => {
    if (r.phone_norm) map.set(r.phone_norm, r.memo ?? "");
  });
  return map;
}

// 블랙리스트 전화번호(정규화) 집합 — 명단/판매내역 대조용
export async function getBlacklistSet(): Promise<Set<string>> {
  const admin = getAdminClient();
  if (!admin) return new Set();
  const { data } = await admin
    .from("blacklist")
    .select("phone_norm")
    .returns<{ phone_norm: string | null }[]>();
  return new Set((data ?? []).map((r) => r.phone_norm).filter(Boolean) as string[]);
}
