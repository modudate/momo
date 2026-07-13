import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify";
import { cancel as kcpCancel } from "@/lib/kcp/client";
import { isKcpConfigured } from "@/lib/kcp/config";
import { computeRefundRate } from "@/lib/refund";

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

type CancelBody = {
  id?: string;
  /** true 면 환불 없이 상태만 취소 (미결제 건 정리용) */
  skipRefund?: boolean;
};

type PaidOrder = {
  id: string;
  status: string;
  amount: number;
  meeting_id: string;
  group_id: string | null;
  pg_tid: string | null;
  created_at: string;
  refund_amount: number | null;
  buyer_name: string | null;
  meetings: { title: string; date: string } | null;
};

// 주문 취소 (관리자)
//  · 결제완료 건이면 환불 규정에 따라 KCP 환불까지 실행
//    - 100% 환불 → 남은 금액이 0이면 전체취소(STSC), 아니면 부분취소(STPC)
//    - 50%  환불 → 부분취소(STPC)
//  · 다인 결제(한 거래에 여러 티켓)는 이 티켓 몫만 부분취소한다
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) {
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

  const { data: order } = await admin
    .from("orders")
    .select(
      "id,status,amount,meeting_id,group_id,pg_tid,created_at,refund_amount,buyer_name,meetings(title,date)",
    )
    .eq("id", body.id)
    .single<PaidOrder>();
  if (!order) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.status === "cancelled") {
    return NextResponse.json({ error: "already_cancelled" }, { status: 409 });
  }

  let refundAmount = 0;
  let refundRate: number | null = null;

  // ---- 결제완료 건 → 실제 환불 ----
  const needsRefund =
    order.status === "paid" && order.pg_tid && isKcpConfigured && !body.skipRefund;

  if (needsRefund) {
    const meetingDate = order.meetings?.date ?? "";
    refundRate = computeRefundRate({
      appliedAtMs: new Date(order.created_at).getTime(),
      cancelAtMs: Date.now(),
      meetingDate,
    });
    refundAmount = Math.floor((order.amount * refundRate) / 100);

    // 같은 결제(거래)에 묶인 티켓들 — 부분취소 금액 계산용
    const { data: siblings } = await admin
      .from("orders")
      .select("id,amount,status,refund_amount")
      .eq("pg_tid", order.pg_tid)
      .returns<{ id: string; amount: number; status: string; refund_amount: number | null }[]>();

    const all = siblings ?? [order];
    const paidTotal = all.reduce((s, o) => s + (o.amount ?? 0), 0);
    const alreadyRefunded = all.reduce((s, o) => s + (o.refund_amount ?? 0), 0);
    const remainingBefore = paidTotal - alreadyRefunded;

    // 이 거래에 이미 부분취소가 있었는가
    //  → 있었다면 잔액을 전부 취소하더라도 전체취소(STSC)는 쓸 수 없다 (KCP 규정)
    const hasPriorPartial = alreadyRefunded > 0;

    if (refundAmount > remainingBefore) refundAmount = remainingBefore; // 방어

    if (refundAmount > 0) {
      const remainingAfter = remainingBefore - refundAmount;
      const result = await kcpCancel({
        tno: order.pg_tid!,
        reason: `고객 취소 (환불 ${refundRate}%)`,
        modMny: refundAmount,
        remMny: remainingAfter,
        hasPriorPartial,
      });

      if (!result.ok) {
        return NextResponse.json(
          {
            error: "refund_failed",
            res_cd: result.res_cd,
            res_msg: result.res_msg,
            hint: "KCP 환불이 거부됐어요. 주문 상태는 그대로 유지했습니다.",
          },
          { status: 402 },
        );
      }
    }
  }

  // ---- 주문 취소 처리 ----
  const { error } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      refund_amount: refundAmount || null,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: "cancel_failed", detail: error.message }, { status: 500 });
  }

  void notifyAdmins(
    "❌ 신청 취소",
    `${order.meetings?.title ?? "모임"} · ${order.buyer_name ?? "신청자"} · ${order.amount.toLocaleString("ko-KR")}원` +
      (refundAmount > 0 ? ` → ${refundRate}% 환불 ${refundAmount.toLocaleString("ko-KR")}원` : " (환불 없음)"),
  );

  return NextResponse.json({ ok: true, refundAmount, refundRate });
}
