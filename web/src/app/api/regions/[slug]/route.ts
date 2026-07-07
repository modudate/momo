import { NextResponse } from "next/server";
import { getRegionWithEvents } from "@/lib/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const region = await getRegionWithEvents(slug);
  if (!region) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // CDN 캐시 30초 + 백그라운드 갱신 → 재방문 즉시 응답 (잔여석은 최대 30초 지연)
  return NextResponse.json(region, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" },
  });
}
