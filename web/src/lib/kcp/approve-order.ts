import { getAdminClient } from "@/lib/supabase/admin";
import { approve } from "./client";
import { ordrNoToGroupId } from "./order-no";
import { notifyAdmins } from "@/lib/notify";
import { payLog, maskFields } from "./log";

// 결제 승인 공통 처리 — PC(결제창 콜백)와 모바일(Ret_URL 콜백)이 같이 쓴다.
//
// 보안 원칙 (KCP "결제검증" 가이드)
//   · 결제금액(ordr_mony)·결제수단(pay_type)·주문번호(ordr_no)를 승인 요청에 실어 KCP가 대조하게 한다.
//     → 금액이 위변조되면 KCP가 8059/S006 로 거절한다.
//   · 금액은 반드시 DB 값을 쓴다 (브라우저가 보낸 값 금지).
//   · 이미 결제된 그룹은 다시 승인하지 않는다.

export type ApproveOutcome =
  | { ok: true; tno: string; amount: number; count: number; meetingId: string }
  | { ok: false; error: string; message?: string; meetingId?: string };

export async function approveGroupOrder(params: {
  ordrNo: string;
  encData: string;
  encInfo: string;
  payType: string;
  /** 결제창이 내려준 거래코드 — 임의로 정하면 안 된다 */
  tranCd?: string;
  /** 세션이 있는 경로(PC)에서만 전달 — 본인 주문인지 확인용 */
  userId?: string | null;
}): Promise<ApproveOutcome> {
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "not_configured" };

  const groupId = ordrNoToGroupId(params.ordrNo);
  if (!groupId) return { ok: false, error: "bad_order_no" };

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

  if (!orders || orders.length === 0) return { ok: false, error: "order_not_found" };

  const meetingId = orders[0].meeting_id;

  // 세션이 있는 경로에서는 본인 주문인지 확인
  if (params.userId && orders.some((o) => o.user_id !== params.userId)) {
    return { ok: false, error: "forbidden", meetingId };
  }

  // 이미 결제 완료 → 중복 콜백으로 보고 성공 처리
  if (orders.every((o) => o.status === "paid")) {
    const total = orders.reduce((s, o) => s + (o.amount ?? 0), 0);
    return { ok: true, tno: "", amount: total, count: orders.length, meetingId };
  }

  const pendings = orders.filter((o) => o.status === "pending");
  if (pendings.length === 0) {
    await payLog("error", params.ordrNo, {
      이유: "order_not_pending",
      상태: orders.map((o) => o.status),
    });
    return { ok: false, error: "order_not_pending", meetingId };
  }

  // 자리 홀드가 만료됐으면 승인하지 않는다 (다른 사람이 자리를 가져갔을 수 있음)
  const expired = pendings.some(
    (o) => o.expires_at && new Date(o.expires_at).getTime() < Date.now(),
  );
  if (expired) {
    await payLog("error", params.ordrNo, {
      이유: "hold_expired",
      만료시각: pendings.map((o) => o.expires_at),
      지금: new Date().toISOString(),
    });
    await admin.from("orders").update({ status: "failed" }).eq("group_id", groupId).eq("status", "pending");
    return { ok: false, error: "hold_expired", meetingId };
  }

  // ★ 금액은 DB 기준
  const total = pendings.reduce((s, o) => s + (o.amount ?? 0), 0);

  const result = await approve({
    ordr_no: params.ordrNo,
    ordr_mony: total,
    pay_type: params.payType,
    enc_data: params.encData,
    enc_info: params.encInfo,
    tran_cd: params.tranCd,
  });

  // 승인 요청/응답 기록 (실패 원인 진단용)
  await payLog("approve_res", params.ordrNo, {
    보낸금액: total,
    pay_type: params.payType,
    tran_cd: params.tranCd || "(기본값)",
    enc_data길이: params.encData.length,
    enc_info길이: params.encInfo.length,
    res_cd: result.res_cd,
    res_msg: result.res_msg,
    tno: result.tno,
    승인금액: result.amount,
    // 승인 성공 응답엔 카드번호(마스킹본)·구매자 정보가 들어올 수 있다 → 반드시 가리고 저장
    raw: maskFields(result.raw as Record<string, unknown>),
  });

  if (!result.ok) {
    await admin.from("orders").update({ status: "failed" }).eq("group_id", groupId).eq("status", "pending");
    return {
      ok: false,
      error: "approve_failed",
      message: `${result.res_msg} (${result.res_cd})`,
      meetingId,
    };
  }

  // 승인 금액이 다르면 위험 상황 — 즉시 실패 처리하고 관리자에게 알림
  if (result.amount != null && result.amount !== total) {
    await admin.from("orders").update({ status: "failed" }).eq("group_id", groupId).eq("status", "pending");
    void notifyAdmins(
      "🚨 결제 금액 불일치",
      `주문 ${params.ordrNo} · 요청 ${total}원 / 승인 ${result.amount}원 · 거래번호 ${result.tno} · 즉시 확인 필요`,
    );
    return { ok: false, error: "amount_mismatch", meetingId };
  }

  const { data: paidRows, error } = await admin.rpc("mark_group_paid", {
    p_group_id: groupId,
    p_tno: result.tno ?? "",
  });

  if (error) {
    // 돈은 빠져나갔는데 저장이 안 된 최악의 경우 — 반드시 사람이 확인해야 한다
    void notifyAdmins(
      "🚨 결제됐으나 저장 실패",
      `주문 ${params.ordrNo} · 거래번호 ${result.tno} · ${total.toLocaleString("ko-KR")}원 · 수동 확인 필요`,
    );
    return { ok: false, error: "save_failed", meetingId };
  }

  const count = Array.isArray(paidRows) ? paidRows.length : pendings.length;
  void notifyAdmins(
    "💳 결제 완료",
    `${count}매 · ${total.toLocaleString("ko-KR")}원 · 거래번호 ${result.tno}`,
  );

  return { ok: true, tno: result.tno ?? "", amount: total, count, meetingId };
}
