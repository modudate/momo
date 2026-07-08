import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";

type DbTpl = {
  id: string;
  category: string;
  region_slug: string;
  age_group: string;
  title: string;
  image: string | null;
  home_section: string | null;
  home_badge: string | null;
  home_sort: number;
};

// 인증 섹션 카드의 주황 라벨 (카테고리 → 표기)
const premiumLabel: Record<string, string> = {
  premium: "프리미엄",
  popular: "인기남녀",
};

function mapCard(t: DbTpl, section: "signature" | "premium") {
  return {
    id: t.id,
    label: section === "signature" ? "시그니처" : premiumLabel[t.category] ?? "인증",
    title: t.title,
    badge: t.home_badge ?? "",
    // 나이대: "2030, 3045" 처럼 콤마/공백 구분 입력 → 태그 배열
    tags: (t.age_group ?? "")
      .split(/[,\s/]+/)
      .map((s) => s.trim())
      .filter((s) => s && s !== "all" && s !== "전연령"),
    image: t.image,
    href: `/moim/${t.id}`, // 홈 노출 모임 전용 상세페이지
  };
}

export type HeroContent = {
  badge: string;
  title: string;
  sub: string;
  images: string[];
};

// 홈 콘텐츠 — 히어로 배너(site_content) + 홈 노출 플래그된 상품 카드 (공개)
export async function GET() {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ hero: null, signature: [], premium: [] });

  const [{ data }, { data: heroRow }] = await Promise.all([
    admin
      .from("moim_templates")
      .select("id,category,region_slug,age_group,title,image,home_section,home_badge,home_sort")
      .in("home_section", ["signature", "premium"])
      .order("home_sort", { ascending: true })
      .returns<DbTpl[]>(),
    admin.from("site_content").select("value").eq("key", "hero").maybeSingle<{ value: HeroContent }>(),
  ]);

  const rows = data ?? [];
  // CDN 캐시 60초 + 백그라운드 갱신 (관리자 변경은 최대 1분 내 반영)
  return NextResponse.json(
    {
      hero: heroRow?.value ?? null,
      signature: rows.filter((t) => t.home_section === "signature").map((t) => mapCard(t, "signature")),
      premium: rows.filter((t) => t.home_section === "premium").map((t) => mapCard(t, "premium")),
    },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
