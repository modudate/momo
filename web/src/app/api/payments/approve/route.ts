import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { approve } from "@/lib/kcp/client";
import { isKcpConfigured } from "@/lib/kcp/config";
import { ordrNoToGroupId } from "@/lib/kcp/order-no";
import { notifyAdmins } from "@/lib/notify";

// 결제 승인 — 결제창 인증(enc_data/enc_info)을 받아 KCP 최종 승인 후 주문을 결제완료 처리
//
// 보안 원칙
//  1) 금액은 절대 클라이언트 값을 믿지 않는다 → DB의 주문 합계로 승인 요청
//  2) 이미 결제된 그룹은 다시 승인하지 않는다 (mark_group_paid 가 0건이면 중복)
//  3) 승인 실패 시 자리를 즉시 반납한다 (failed)
export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  if (!isKcpConfigured) {
    return NextResponse.json({ error: "kcp_not_configured" }, { status: 503 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: {
    ordr_no?: string;
    enc_data?: string;
    enc_info?: string;
    pay_type?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.ordr_no || !body.enc_data || !body.enc_info) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const groupId = ordrNoToGroupId(body.ordr_no);
  if (!groupId) return NextResponse.json({ error: "bad_order_no" }, { status: 400 });

  // 이 그룹의 주문들 (본인 것인지 + 결제 대기 중인지 확인)
  const { data: orders } = await admin
    .from("orders")
    .select("id,user_id,amount,status,meeting_id,expires_at")
    .eq("group_id", groupId)
    .returns<
      {
        id: string;
        user_id: string | null;
        amount: number;
        status: string;
        meeting_id: string;
        expires_at: string | null;
      }[]
    >();

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (orders.some((o) => o.user_id !== user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (orders.every((o) => o.status === "paid")) {
    return NextResponse.json({ ok: true, alreadyPaid: true }); // 중복 승인 요청 — 그대로 성공 처리
  }
  if (!orders.some((o) => o.status === "pending")) {
    return NextResponse.json({ error: "order_not_pending" }, { status: 409 });
  }

  // 자리 홀드가 이미 만료됐으면 승인하지 않는다 (다른 사람이 자리를 가져갔을 수 있음)
  const expired = orders.some(
    (o) => o.status === "pending" && o.expires_at && new Date(o.expires_at).getTime() < Date.now(),
  );
  if (expired) {
    await admin.from("orders").update({ status: "failed" }).eq("group_id", groupId).eq("status", "pending");
    return NextResponse.json({ error: "hold_expired" }, { status: 409 });
  }

  // ★ 금액은 DB 기준 (클라이언트가 보낸 값은 쓰지 않는다)
  const total = orders
    .filter((o) => o.status === "pending")
    .reduce((s, o) => s + (o.amount ?? 0), 0);

  const result = await approve({
    ordr_no: body.ordr_no,
    ordr_mony: total,
    pay_type: body.pay_type || "PACA", // 신용카드
    enc_data: body.enc_data,
    enc_info: body.enc_info,
  });

  if (!result.ok) {
    // 승인 실패 → 자리 반납
    await admin
      .from("orders")
      .update({ status: "failed" })
      .eq("group_id", groupId)
      .eq("status", "pending");
    return NextResponse.json(
      { error: "approve_failed", res_cd: result.res_cd, res_msg: result.res_msg },
      { status: 402 },
    );
  }

  // KCP가 승인한 금액이 우리 금액과 다르면 즉시 취소해야 하는 위험 상황 → 기록 후 실패 처리
  if (result.amount != null && result.amount !== total) {
    await admin
      .from("orders")
      .update({ status: "failed" })
      .eq("group_id", groupId)
      .eq("status", "pending");
    void notifyAdmins(
      "🚨 결제 금액 불일치",
      `주문 ${body.ordr_no} · 요청 ${total}원 / 승인 ${result.amount}원 (거래번호 ${result.tno})`,
    );
    return NextResponse.json({ error: "amount_mismatch" }, { status: 409 });
  }

  // 그룹 전체를 결제완료로 (원자적, 중복 승인 방지)
  const { data: paidRows, error } = await admin.rpc("mark_group_paid", {
    p_group_id: groupId,
    p_tno: result.tno ?? "",
  });
  if (error) {
    void notifyAdmins(
      "🚨 결제는 됐으나 저장 실패",
      `주문 ${body.ordr_no} · 거래번호 ${result.tno} · 즉시 확인 필요`,
    );
    return NextResponse.json({ error: "save_failed", tno: result.tno }, { status: 500 });
  }

  const count = Array.isArray(paidRows) ? paidRows.length : 0;
  void notifyAdmins(
    "💳 결제 완료",
    `${count}매 · ${total.toLocaleString("ko-KR")}원 · 거래번호 ${result.tno}`,
  );

  return NextResponse.json({ ok: true, tno: result.tno, amount: total, count });
}
