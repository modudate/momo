import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { getBlacklistSet, normPhone } from "@/lib/blacklist";

type DbOrder = {
  id: string;
  amount: number;
  status: string;
  gender: string | null;
  option_label: string | null;
  attended: boolean;
  buyer_name: string | null;
  buyer_phone: string | null;
  user_id: string | null;
  meeting_id: string;
  created_at: string;
  meetings: {
    title: string;
    date: string;
    time: string;
    region_slug: string;
    regions: { name: string } | null;
  } | null;
};

type DbProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
};

// 판매(주문) 검색·필터 목록 (관리자)
//   GET /api/admin/sales?q=&region=&status=&gender=&from=&to=
export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const region = url.searchParams.get("region") ?? "all";
  const status = url.searchParams.get("status") ?? "all";
  const gender = url.searchParams.get("gender") ?? "all";
  const from = url.searchParams.get("from") ?? ""; // 모임 날짜 기준 YYYY-MM-DD
  const to = url.searchParams.get("to") ?? "";

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if ((from && !dateRe.test(from)) || (to && !dateRe.test(to))) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const { data: ordersRaw } = await admin
    .from("orders")
    .select(
      "id,amount,status,gender,option_label,attended,buyer_name,buyer_phone,user_id,meeting_id,created_at,meetings(title,date,time,region_slug,regions(name))",
    )
    .order("created_at", { ascending: false })
    .returns<DbOrder[]>();
  const orders = ordersRaw ?? [];

  // 회원 프로필 매핑
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, DbProfile>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id,name,phone,birth_year")
      .in("id", userIds)
      .returns<DbProfile[]>();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
  }

  const blacklist = await getBlacklistSet();

  let rows = orders.map((o) => {
    const p = o.user_id ? profileMap.get(o.user_id) : undefined;
    const phone = p?.phone ?? o.buyer_phone ?? null;
    return {
      id: o.id,
      amount: o.amount,
      status: o.status,
      gender: o.gender,
      option_label: o.option_label,
      attended: o.attended,
      created_at: o.created_at,
      meeting_id: o.meeting_id,
      meeting_title: o.meetings?.title ?? "모임",
      meeting_date: o.meetings?.date ?? null,
      meeting_time: o.meetings?.time ?? null,
      region_slug: o.meetings?.region_slug ?? null,
      region_name: o.meetings?.regions?.name ?? o.meetings?.region_slug ?? "-",
      member_name: p?.name ?? null,
      name: o.buyer_name ?? p?.name ?? null,
      phone,
      birth_year: p?.birth_year ?? null,
      blacklisted: phone ? blacklist.has(normPhone(phone)) : false,
    };
  });

  // 필터 (서버 측 JS — 데이터 규모 작음)
  if (region !== "all") rows = rows.filter((r) => r.region_slug === region);
  if (status !== "all") rows = rows.filter((r) => r.status === status);
  if (gender !== "all") rows = rows.filter((r) => r.gender === gender);
  if (from) rows = rows.filter((r) => r.meeting_date && r.meeting_date >= from);
  if (to) rows = rows.filter((r) => r.meeting_date && r.meeting_date <= to);
  if (q) {
    const qDigits = q.replace(/\D/g, "");
    rows = rows.filter(
      (r) =>
        [r.id, r.name, r.member_name, r.meeting_title]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)) ||
        (qDigits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(qDigits)),
    );
  }

  return NextResponse.json({ orders: rows, count: rows.length });
}
