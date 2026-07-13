import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { approveGroupOrder } from "@/lib/kcp/approve-order";
import { isKcpConfigured } from "@/lib/kcp/config";

// 결제 승인 (PC 결제창 콜백 경로)
//  모바일은 KCP 가 /api/payments/return 으로 폼 POST 하므로 그쪽에서 처리한다.
export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  if (!isKcpConfigured) {
    return NextResponse.json({ error: "kcp_not_configured" }, { status: 503 });
  }

  let body: {
    ordr_no?: string;
    enc_data?: string;
    enc_info?: string;
    pay_type?: string;
    tran_cd?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.ordr_no || !body.enc_data || !body.enc_info) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const outcome = await approveGroupOrder({
    ordrNo: body.ordr_no,
    encData: body.enc_data,
    encInfo: body.enc_info,
    payType: body.pay_type || "PACA",
    tranCd: body.tran_cd || undefined, // 결제창이 내려준 값
    userId: user.id,
  });

  if (!outcome.ok) {
    const status =
      outcome.error === "forbidden"
        ? 403
        : outcome.error === "order_not_found"
          ? 404
          : outcome.error === "approve_failed"
            ? 402
            : outcome.error === "save_failed"
              ? 500
              : 409;
    return NextResponse.json(
      { error: outcome.error, res_msg: outcome.message },
      { status },
    );
  }

  return NextResponse.json({
    ok: true,
    tno: outcome.tno,
    amount: outcome.amount,
    count: outcome.count,
  });
}
