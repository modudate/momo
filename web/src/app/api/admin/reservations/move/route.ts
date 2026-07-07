import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { getMeetingOptions } from "@/lib/data";

// 신청자(주문)를 다른 일정으로 이동 — 대상 일정 자리 없으면 거절
//   POST { orderId, targetMeetingId }
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { orderId?: string; targetMeetingId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.orderId || !body.targetMeetingId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data: order } = await admin
    .from("orders")
    .select("id,meeting_id,option_id,status")
    .eq("id", body.orderId)
    .single<{ id: string; meeting_id: string; option_id: string | null; status: string }>();
  if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  if (order.status === "cancelled") {
    return NextResponse.json({ error: "cancelled_order" }, { status: 400 });
  }
  if (order.meeting_id === body.targetMeetingId) {
    return NextResponse.json({ error: "same_meeting" }, { status: 400 });
  }

  const { data: target } = await admin
    .from("meetings")
    .select("id,capacity")
    .eq("id", body.targetMeetingId)
    .single<{ id: string; capacity: number }>();
  if (!target) return NextResponse.json({ error: "target_not_found" }, { status: 404 });

  // 대상 일정 잔여석 검증
  if (order.option_id) {
    const options = await getMeetingOptions(body.targetMeetingId);
    const opt = options.find((o) => o.id === order.option_id);
    if (!opt) {
      // 대상이 다른 상품(템플릿)이라 같은 옵션이 없음
      return NextResponse.json({ error: "option_not_in_target" }, { status: 400 });
    }
    if (opt.joined >= opt.capacity) {
      return NextResponse.json({ error: "target_full" }, { status: 409 });
    }
  } else {
    const { count } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("meeting_id", body.targetMeetingId)
      .neq("status", "cancelled");
    if ((count ?? 0) >= target.capacity) {
      return NextResponse.json({ error: "target_full" }, { status: 409 });
    }
  }

  const { error } = await admin
    .from("orders")
    .update({ meeting_id: body.targetMeetingId })
    .eq("id", body.orderId);
  if (error) {
    return NextResponse.json({ error: "move_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
