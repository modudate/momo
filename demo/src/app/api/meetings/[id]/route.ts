import { NextResponse } from "next/server";
import { getMeetingDetail, getMeetingOptions, getMeetingCounts } from "@/lib/data";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const meeting = await getMeetingDetail(id);
  if (!meeting) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const [options, counts] = await Promise.all([getMeetingOptions(id), getMeetingCounts(id)]);
  // CDN 캐시 15초 + 백그라운드 갱신 (재방문 즉시 응답)
  return NextResponse.json(
    {
      ...meeting,
      options,
      counts: counts ?? {
        capacity: meeting.capacity,
        total: meeting.joined,
        male: 0,
        female: 0,
      },
    },
    { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=120" } },
  );
}
