import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

type DbOrder = {
  amount: number;
  status: string;
  gender: string | null;
  meetings: {
    date: string;
    region_slug: string;
    regions: { name: string } | null;
  } | null;
};

// "YYYY-MM" 키를 끝월부터 n개 역순 생성 → 오름차순 반환
function lastMonths(endYear: number, endMon: number, n: number) {
  const keys: string[] = [];
  let y = endYear;
  let m = endMon;
  for (let i = 0; i < n; i++) {
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return keys.reverse();
}

// 매출 분석 — 매출은 "취소 제외" 주문 금액, 시점은 모임(행사) 날짜 기준
//   GET /api/admin/sales/analytics
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  // KST 현재 연/월
  const kst = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const curYear = Number(kst.slice(0, 4));
  const curMon = Number(kst.slice(5, 7));
  const curMonthKey = `${kst.slice(0, 4)}-${kst.slice(5, 7)}`;
  const prevMon = curMon === 1 ? 12 : curMon - 1;
  const prevYear = curMon === 1 ? curYear - 1 : curYear;
  const prevMonthKey = `${prevYear}-${String(prevMon).padStart(2, "0")}`;

  const { data: all } = await admin
    .from("orders")
    .select("amount,status,gender,meetings(date,region_slug,regions(name))")
    .limit(50000) // 대량 증가 대비 안전장치
    .returns<DbOrder[]>();
  const orders = all ?? [];

  // 상태 집계 (전체)
  let paid = 0;
  let pending = 0;
  let cancelled = 0;
  let failed = 0;
  orders.forEach((o) => {
    if (o.status === "paid") paid += 1;
    else if (o.status === "pending") pending += 1;
    else if (o.status === "cancelled") cancelled += 1;
    else if (o.status === "failed") failed += 1;
  });

  // 매출 집계 대상: 결제완료+대기(취소·실패 제외) + 모임 날짜 존재
  const valid = orders.filter(
    (o) => (o.status === "paid" || o.status === "pending") && o.meetings?.date,
  );

  let revenue = 0;
  const byMonth = new Map<string, { revenue: number; count: number }>();
  const byDay = new Map<string, { revenue: number; count: number }>();
  const byRegion = new Map<string, { revenue: number; count: number }>();
  const byGender = new Map<string, { revenue: number; count: number }>();

  valid.forEach((o) => {
    const m = o.meetings;
    if (!m?.date) return;
    const amt = o.amount ?? 0;
    const date = m.date; // YYYY-MM-DD (date-only, KST 행사일)
    const mKey = date.slice(0, 7);
    const regionName = m.regions?.name ?? m.region_slug ?? "-";
    const g = o.gender ?? "unknown";
    revenue += amt;

    const mm = byMonth.get(mKey) ?? { revenue: 0, count: 0 };
    mm.revenue += amt;
    mm.count += 1;
    byMonth.set(mKey, mm);

    const dd = byDay.get(date) ?? { revenue: 0, count: 0 };
    dd.revenue += amt;
    dd.count += 1;
    byDay.set(date, dd);

    const rr = byRegion.get(regionName) ?? { revenue: 0, count: 0 };
    rr.revenue += amt;
    rr.count += 1;
    byRegion.set(regionName, rr);

    const gg = byGender.get(g) ?? { revenue: 0, count: 0 };
    gg.revenue += amt;
    gg.count += 1;
    byGender.set(g, gg);
  });

  // 최근 6개월 시리즈
  const monthly = lastMonths(curYear, curMon, 6).map((key) => ({
    month: key,
    revenue: byMonth.get(key)?.revenue ?? 0,
    count: byMonth.get(key)?.count ?? 0,
  }));

  // 이번 달 일별 시리즈 (1일~말일)
  const daysInMonth = new Date(curYear, curMon, 0).getDate();
  const daily = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${curMonthKey}-${String(d).padStart(2, "0")}`;
    daily.push({
      date: key,
      revenue: byDay.get(key)?.revenue ?? 0,
      count: byDay.get(key)?.count ?? 0,
    });
  }

  // 전월 대비 증감 %
  const thisMonthRev = byMonth.get(curMonthKey)?.revenue ?? 0;
  const lastMonthRev = byMonth.get(prevMonthKey)?.revenue ?? 0;
  const momChangePct =
    lastMonthRev === 0 ? null : Math.round(((thisMonthRev - lastMonthRev) / lastMonthRev) * 1000) / 10;

  const validCount = valid.length;

  return NextResponse.json({
    today: kst, // 서버 KST 오늘 (클라이언트 하이라이트 기준 통일)
    kpi: {
      revenue,
      orders: validCount,
      paid,
      pending,
      cancelled,
      failed,
      avgTicket: validCount === 0 ? 0 : Math.round(revenue / validCount),
    },
    thisMonth: { key: curMonthKey, revenue: thisMonthRev },
    lastMonth: { key: prevMonthKey, revenue: lastMonthRev },
    momChangePct,
    monthly,
    daily,
    byRegion: [...byRegion.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byGender: [...byGender.entries()].map(([gender, v]) => ({ gender, ...v })),
  });
}
