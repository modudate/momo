import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify";

// 주문 목록 조회 (관리자) — 모임 제목 포함
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const { data: orders } = await supabaseAdmin
    .from("orders")
    .select(
      "id,amount,status,buyer_name,buyer_phone,created_at,meeting_id,option_label,gender,meetings(title,date)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return NextResponse.json({ orders: orders ?? [] });
}

type CancelBody = { id?: string };

// 주문 강제 취소 (관리자) — 블랙리스트 대응
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: CancelBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  // 결제완료 주문이면 정원 1 복구
  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("status,meeting_id,buyer_name,amount,meetings(title)")
    .eq("id", body.id)
    .single<{
      status: string;
      meeting_id: string;
      buyer_name: string | null;
      amount: number;
      meetings: { title: string } | null;
    }>();
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }

  if (order.status === "paid" && order.meeting_id) {
    const { data: meeting } = await supabaseAdmin
      .from("meetings")
      .select("joined")
      .eq("id", order.meeting_id)
      .single<{ joined: number }>();
    if (meeting && meeting.joined > 0) {
      await supabaseAdmin
        .from("meetings")
        .update({ joined: meeting.joined - 1 })
        .eq("id", order.meeting_id);
    }
  }

  // 관리자 알림 (취소 발생)
  void notifyAdmins(
    "❌ 신청 취소",
    `${order.meetings?.title ?? "모임"} · ${order.buyer_name ?? "신청자"} · ${order.amount.toLocaleString("ko-KR")}원`,
  );

  return NextResponse.json({ ok: true });
}
