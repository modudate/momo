import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { registerTrade } from "@/lib/kcp/client";
import { isKcpConfigured } from "@/lib/kcp/config";
import { ordrNoToGroupId } from "@/lib/kcp/order-no";

// 거래등록 (모바일 전용)
//  모바일 웹 결제창은 kcp_spay_hub.js 만으론 안 되고, 먼저 KCP 에 거래를 등록해
//  approvalKey / PayUrl 을 받아야 한다. 그 값으로 결제창(전체 페이지)으로 이동한다.
export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  if (!isKcpConfigured) {
    return NextResponse.json({ error: "kcp_not_configured" }, { status: 503 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { ordrNo?: string; goodName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.ordrNo) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const groupId = ordrNoToGroupId(body.ordrNo);
  if (!groupId) return NextResponse.json({ error: "bad_order_no" }, { status: 400 });

  // 내 주문인지 + 결제 대기 상태인지 확인하고, 금액은 DB 에서 확정
  const { data: orders } = await admin
    .from("orders")
    .select("user_id,amount,status")
    .eq("group_id", groupId)
    .returns<{ user_id: string | null; amount: number; status: string }[]>();

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (orders.some((o) => o.user_id !== user.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const pendings = orders.filter((o) => o.status === "pending");
  if (pendings.length === 0) {
    return NextResponse.json({ error: "order_not_pending" }, { status: 409 });
  }
  const total = pendings.reduce((s, o) => s + (o.amount ?? 0), 0);

  // 인증 결과를 돌려받을 우리 주소 (KCP 가 이 주소로 폼 POST 한다)
  const origin =
    req.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://www.joinmomo.co.kr";

  const retUrl = `${origin}/api/payments/return`;

  const result = await registerTrade({
    ordr_idxx: body.ordrNo,
    good_mny: total,
    good_name: body.goodName ?? "모두의 모임",
    ret_url: retUrl,
    user_agent: req.headers.get("user-agent") ?? undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: "register_failed", code: result.code, message: result.message },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    approvalKey: result.approvalKey,
    payUrl: result.payUrl,
    traceNo: result.traceNo,
    // ⚠️ 결제창으로 보내는 폼에도 Ret_URL 을 반드시 같이 실어야 한다 (없으면 KCP M016 오류)
    retUrl,
    amount: total, // 서버가 확정한 금액
  });
}
