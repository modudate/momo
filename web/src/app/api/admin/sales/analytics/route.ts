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

const pad = (n: number) => String(n).padStart(2, "0");

// KST 오늘 (YYYY-MM-DD)
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// 날짜 문자열 ± n일
function addDays(dateStr: string, n: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// 그 주의 월요일 (주 시작)
function weekStart(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=일
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, diff);
}

// 증감 % (전기간 0이면 null)
function changePct(cur: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((cur - prev) / prev) * 1000) / 10;
}

// 매출 분석 — 결제완료+대기(취소·실패 제외), 시점은 모임(행사) 날짜 기준
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const today = todayKST();
  const curYear = Number(today.slice(0, 4));
  const curMon = Number(today.slice(5, 7));

  const { data: all } = await admin
    .from("orders")
    .select("amount,status,gender,meetings(date,region_slug,regions(name))")
    .limit(50000)
    .returns<DbOrder[]>();
  const orders = all ?? [];

  // 상태 집계
  let paid = 0;
  let pending = 0;
  orders.forEach((o) => {
    if (o.status === "paid") paid += 1;
    else if (o.status === "pending") pending += 1;
  });

  // 매출 대상: 결제완료+대기 + 모임 날짜 존재
  const valid = orders.filter(
    (o) => (o.status === "paid" || o.status === "pending") && o.meetings?.date,
  );

  const byDay = new Map<string, number>();
  const byRegion = new Map<string, { revenue: number; count: number }>();
  const byGender = new Map<string, { revenue: number; count: number }>();
  let totalRevenue = 0;

  valid.forEach((o) => {
    const m = o.meetings;
    if (!m?.date) return;
    const amt = o.amount ?? 0;
    totalRevenue += amt;
    byDay.set(m.date, (byDay.get(m.date) ?? 0) + amt);

    const regionName = m.regions?.name ?? m.region_slug ?? "-";
    const rr = byRegion.get(regionName) ?? { revenue: 0, count: 0 };
    rr.revenue += amt;
    rr.count += 1;
    byRegion.set(regionName, rr);

    const g = o.gender ?? "unknown";
    const gg = byGender.get(g) ?? { revenue: 0, count: 0 };
    gg.revenue += amt;
    gg.count += 1;
    byGender.set(g, gg);
  });

  // 구간 합계 (양끝 포함)
  const sumRange = (from: string, to: string) => {
    let s = 0;
    byDay.forEach((v, k) => {
      if (k >= from && k <= to) s += v;
    });
    return s;
  };

  // ---- 비교 카드 (오늘/이번 주/이번 달/연도) ----
  const yesterday = addDays(today, -1);
  const todayRev = byDay.get(today) ?? 0;
  const yesterdayRev = byDay.get(yesterday) ?? 0;

  const thisWeekStart = weekStart(today);
  const lastWeekStart = addDays(thisWeekStart, -7);
  const lastWeekEnd = addDays(thisWeekStart, -1);
  const thisWeekRev = sumRange(thisWeekStart, today); // 이번 주(월~오늘)
  const lastWeekRev = sumRange(lastWeekStart, lastWeekEnd); // 지난주 전체

  const thisMonthStart = `${today.slice(0, 7)}-01`;
  const prevMon = curMon === 1 ? 12 : curMon - 1;
  const prevMonYear = curMon === 1 ? curYear - 1 : curYear;
  const lastMonthStart = `${prevMonYear}-${pad(prevMon)}-01`;
  const lastMonthEnd = addDays(thisMonthStart, -1);
  const thisMonthRev = sumRange(thisMonthStart, today);
  const lastMonthRev = sumRange(lastMonthStart, lastMonthEnd);

  const yearRev = sumRange(`${curYear}-01-01`, `${curYear}-12-31`);

  // ---- 기간별 시리즈 ----
  // 일별: 최근 30일
  const daily: { key: string; label: string; revenue: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = addDays(today, -i);
    daily.push({ key: d, label: `${Number(d.slice(8, 10))}`, revenue: byDay.get(d) ?? 0 });
  }
  // 주별: 최근 12주 (라벨 = 주 시작일 M/D)
  const weekly: { key: string; label: string; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(thisWeekStart, -7 * i);
    const we = addDays(ws, 6);
    weekly.push({
      key: ws,
      label: `${Number(ws.slice(5, 7))}/${Number(ws.slice(8, 10))}`,
      revenue: sumRange(ws, we),
    });
  }
  // 월별: 최근 12개월
  const monthly: { key: string; label: string; revenue: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    let y = curYear;
    let m = curMon - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const start = `${y}-${pad(m)}-01`;
    const end = addDays(m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`, -1);
    monthly.push({ key: start.slice(0, 7), label: `${m}월`, revenue: sumRange(start, end) });
  }
  const avg12 = Math.round(monthly.reduce((s, m) => s + m.revenue, 0) / 12);

  return NextResponse.json({
    today,
    cards: {
      today: { revenue: todayRev, changePct: changePct(todayRev, yesterdayRev) },
      week: { revenue: thisWeekRev, changePct: changePct(thisWeekRev, lastWeekRev) },
      month: { revenue: thisMonthRev, changePct: changePct(thisMonthRev, lastMonthRev) },
      year: { revenue: yearRev, label: `${curYear}년도` },
    },
    kpi: {
      revenue: totalRevenue,
      orders: valid.length,
      paid,
      pending,
      avgTicket: valid.length === 0 ? 0 : Math.round(totalRevenue / valid.length),
    },
    series: { daily, weekly, monthly },
    avg12,
    byRegion: [...byRegion.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue),
    byGender: [...byGender.entries()].map(([gender, v]) => ({ gender, ...v })),
  });
}
