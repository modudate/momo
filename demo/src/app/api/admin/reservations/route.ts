import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { regions } from "@/data/moim-data";

const VALID_REGIONS = new Set<string>(regions.map((r) => r.slug));

// 예약 관리 — 한 달치 일정 + 일정별 신청 인원/성비/매출 집계
//   GET /api/admin/reservations?month=YYYY-MM&region=slug
//   region 생략(또는 all) 시 전 지점
export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const month = url.searchParams.get("month") ?? ""; // YYYY-MM
  const region = url.searchParams.get("region") ?? "all";

  // 월 범위 계산 (YYYY-MM-01 ~ 다음달 01 미만)
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) {
    return NextResponse.json({ error: "month_required" }, { status: 400 });
  }
  if (region !== "all" && !VALID_REGIONS.has(region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }

  const year = Number(match[1]);
  const mon = Number(match[2]);
  // 날짜 컬럼은 date 타입(YYYY-MM-DD) → 문자열 비교가 사전식으로 안전. 12월→다음해 1월 처리.
  const start = `${match[1]}-${match[2]}-01`;
  const nextMon = mon === 12 ? 1 : mon + 1;
  const nextYear = mon === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMon).padStart(2, "0")}-01`;

  // 1) 해당 월 일정
  let meetingsQuery = supabaseAdmin
    .from("meetings")
    .select(
      "id,region_slug,template_id,date,time,title,tag,price,capacity,description,place,closed_male,closed_female,virtual_male,virtual_female,regions(name)",
    )
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: true })
    .order("time", { ascending: true });
  if (region !== "all") meetingsQuery = meetingsQuery.eq("region_slug", region);

  const { data: meetingsRaw } = await meetingsQuery.returns<
    {
      id: string;
      region_slug: string;
      template_id: string | null;
      date: string;
      time: string;
      title: string;
      tag: string;
      price: number;
      capacity: number;
      description: string | null;
      place: string | null;
      closed_male: boolean | null;
      closed_female: boolean | null;
      virtual_male: number | null;
      virtual_female: number | null;
      regions: { name: string } | null;
    }[]
  >();
  const meetings = meetingsRaw ?? [];

  // 2) 그 일정들의 주문 집계 (취소 제외)
  const ids = meetings.map((m) => m.id);
  const agg = new Map<
    string,
    { joined: number; male: number; female: number; revenue: number }
  >();
  if (ids.length > 0) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("meeting_id,amount,gender,status")
      .in("meeting_id", ids)
      .neq("status", "cancelled")
      .returns<
        { meeting_id: string; amount: number; gender: string | null; status: string }[]
      >();
    // 결제 연동(KCP) 전까지는 모든 주문이 pending → 취소 제외 합계를 "예상 매출"로 집계.
    // 결제 도입 후에는 실매출은 status='paid'만 집계하도록 분리 필요.
    (orders ?? []).forEach((o) => {
      const cur = agg.get(o.meeting_id) ?? { joined: 0, male: 0, female: 0, revenue: 0 };
      cur.joined += 1;
      cur.revenue += o.amount ?? 0;
      if (o.gender === "male") cur.male += 1;
      else if (o.gender === "female") cur.female += 1;
      agg.set(o.meeting_id, cur);
    });
  }

  const items = meetings.map((m) => {
    const a = agg.get(m.id) ?? { joined: 0, male: 0, female: 0, revenue: 0 };
    return {
      id: m.id,
      region_slug: m.region_slug,
      template_id: m.template_id,
      region_name: m.regions?.name ?? m.region_slug,
      date: m.date,
      time: m.time,
      title: m.title,
      tag: m.tag,
      price: m.price,
      capacity: m.capacity,
      description: m.description,
      place: m.place,
      closed_male: m.closed_male ?? false,
      closed_female: m.closed_female ?? false,
      virtual_male: m.virtual_male ?? 0,
      virtual_female: m.virtual_female ?? 0,
      joined: a.joined,
      male: a.male,
      female: a.female,
      revenue: a.revenue,
    };
  });

  return NextResponse.json({ month, region, meetings: items });
}
