import { getAdminClient } from "@/lib/supabase/admin";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr";

// KST 오늘 (YYYY-MM-DD)
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// RSS 2.0 — 다가오는 모임 피드 (네이버 서치어드바이저 RSS 제출용)
export async function GET() {
  type Row = {
    id: string;
    title: string;
    date: string;
    time: string;
    price: number;
    region_slug: string;
    created_at: string;
    regions: { name: string } | null;
  };

  let rows: Row[] = [];
  const admin = getAdminClient();
  if (admin) {
    const { data } = await admin
      .from("meetings")
      .select("id,title,date,time,price,region_slug,created_at,regions(name)")
      .gte("date", todayKST())
      .order("date", { ascending: true })
      .limit(100)
      .returns<Row[]>();
    rows = data ?? [];
  }

  const items = rows
    .map((m) => {
      const region = m.regions?.name ?? m.region_slug;
      const title = `[${region}] ${m.title} — ${Number(m.date.slice(5, 7))}월 ${Number(m.date.slice(8, 10))}일 ${m.time}`;
      const desc = `${region}에서 열리는 오프라인 모임 · ${m.date} ${m.time} · 참가비 ${m.price.toLocaleString("ko-KR")}원 · 모두의 모임에서 바로 신청하세요.`;
      const pub = new Date(m.created_at || Date.now()).toUTCString();
      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${BASE}/meeting/${m.id}</link>
      <guid isPermaLink="true">${BASE}/meeting/${m.id}</guid>
      <description>${escapeXml(desc)}</description>
      <pubDate>${pub}</pubDate>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>모두의 모임 — 강남·홍대·수원 오프라인 모임</title>
    <link>${BASE}</link>
    <description>강남·홍대·수원에서 열리는 와인·커피 오프라인 소셜 모임 일정</description>
    <language>ko</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
