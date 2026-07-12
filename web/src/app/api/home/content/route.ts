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
  home_label: string | null;
  home_sort: number;
};

type DbSection = { key: string; title: string; card_label: string; sort: number };

function mapCard(t: DbTpl, sectionLabel: string) {
  return {
    id: t.id,
    // 상품별 라벨이 있으면 그것, 없으면 섹션 기본 라벨
    label: t.home_label?.trim() || sectionLabel,
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

// 홈 콘텐츠 — 히어로 배너 + 카테고리(섹션)별 상품 카드 (공개)
export async function GET() {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ hero: null, sections: [] });

  const [{ data: tpls }, { data: secs }, { data: heroRow }] = await Promise.all([
    admin
      .from("moim_templates")
      .select(
        "id,category,region_slug,age_group,title,image,home_section,home_badge,home_label,home_sort",
      )
      .not("home_section", "is", null)
      .order("home_sort", { ascending: true })
      .returns<DbTpl[]>(),
    admin
      .from("home_sections")
      .select("key,title,card_label,sort")
      .order("sort", { ascending: true })
      .returns<DbSection[]>(),
    admin.from("site_content").select("value").eq("key", "hero").maybeSingle<{ value: HeroContent }>(),
  ]);

  const rows = tpls ?? [];
  // 카드가 하나도 없는 섹션은 홈에서 숨김
  const sections = (secs ?? [])
    .map((s) => ({
      key: s.key,
      title: s.title,
      cards: rows.filter((t) => t.home_section === s.key).map((t) => mapCard(t, s.card_label)),
    }))
    .filter((s) => s.cards.length > 0);

  // CDN 캐시 60초 + 백그라운드 갱신 (관리자 변경은 최대 1분 내 반영)
  return NextResponse.json(
    { hero: heroRow?.value ?? null, sections },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=600" } },
  );
}
