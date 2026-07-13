import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { getBlacklistSet, normPhone } from "@/lib/blacklist";
import { holdsSeat, SEAT_STATUSES } from "@/lib/orders";

type DbOrder = {
  id: string;
  status: string;
  birth_year: number | null;
  attended: boolean;
  gender: string | null;
  option_label: string | null;
  amount: number;
  buyer_name: string | null;
  buyer_phone: string | null;
  expires_at: string | null;
  user_id: string | null;
  created_at: string;
};

type DbProfile = {
  id: string;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: string | null;
};

// 일정 참석자 명단 (성별 분리용 데이터) — 취소 제외
//   GET /api/admin/reservations/attendees?meetingId=xxx
export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const meetingId = new URL(req.url).searchParams.get("meetingId");
  if (!meetingId) {
    return NextResponse.json({ error: "meeting_required" }, { status: 400 });
  }

  // 일정 정보
  const { data: meeting } = await supabaseAdmin
    .from("meetings")
    .select("id,region_slug,date,time,title,capacity,regions(name)")
    .eq("id", meetingId)
    .single<{
      id: string;
      region_slug: string;
      date: string;
      time: string;
      title: string;
      capacity: number;
      regions: { name: string } | null;
    }>();
  if (!meeting) {
    return NextResponse.json({ error: "meeting_not_found" }, { status: 404 });
  }

  // 주문(신청) 목록 — 자리를 잡고 있는 건만 (만료된 미결제·실패 제외)
  const { data: ordersRaw } = await supabaseAdmin
    .from("orders")
    .select(
      "id,status,attended,gender,option_label,amount,buyer_name,buyer_phone,birth_year,expires_at,user_id,created_at",
    )
    .eq("meeting_id", meetingId)
    .in("status", SEAT_STATUSES)
    .order("created_at", { ascending: true })
    .returns<DbOrder[]>();
  const orders = (ordersRaw ?? []).filter((o) => holdsSeat(o));

  // 회원 프로필 매핑 (orders.user_id → profiles.id)
  const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))] as string[];
  const profileMap = new Map<string, DbProfile>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id,name,phone,birth_year,gender")
      .in("id", userIds)
      .returns<DbProfile[]>();
    (profiles ?? []).forEach((p) => profileMap.set(p.id, p));
  }

  const blacklist = await getBlacklistSet();

  const attendees = orders.map((o) => {
    const p = o.user_id ? profileMap.get(o.user_id) : undefined;
    const phone = p?.phone ?? o.buyer_phone ?? null;
    return {
      order_id: o.id,
      status: o.status,
      attended: o.attended,
      // 성별: 구매 옵션의 성별 우선, 없으면 회원 프로필 성별
      gender: o.gender ?? p?.gender ?? null,
      option_label: o.option_label,
      amount: o.amount,
      member_name: p?.name ?? null, // 회원명(가입명)
      name: o.buyer_name ?? p?.name ?? null, // 이름(실명)
      phone,
      birth_year: o.birth_year ?? p?.birth_year ?? null, // 티켓 참가자 우선
      blacklisted: phone ? blacklist.has(normPhone(phone)) : false,
    };
  });

  return NextResponse.json({ meeting, attendees });
}

// 참석여부(체크인) 토글
//   PATCH { orderId, attended }
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: { orderId?: string; attended?: boolean; meetingId?: string; allAttended?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.meetingId) {
    return NextResponse.json({ error: "meeting_required" }, { status: 400 });
  }

  // 전체 참석 토글 (해당 일정의 취소 제외 전원)
  if (typeof body.allAttended === "boolean") {
    const { error } = await supabaseAdmin
      .from("orders")
      .update({ attended: body.allAttended })
      .eq("meeting_id", body.meetingId)
      .neq("status", "cancelled");
    if (error) {
      return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.orderId) {
    return NextResponse.json({ error: "order_required" }, { status: 400 });
  }
  if (typeof body.attended !== "boolean") {
    return NextResponse.json({ error: "attended_invalid" }, { status: 400 });
  }

  // 주문이 해당 일정 소속인지 검증 (IDOR 방지)
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("meeting_id")
    .eq("id", body.orderId)
    .single<{ meeting_id: string }>();
  if (!order || order.meeting_id !== body.meetingId) {
    return NextResponse.json({ error: "order_mismatch" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ attended: body.attended })
    .eq("id", body.orderId);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
