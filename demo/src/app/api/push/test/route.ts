import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/server";
import { isPushConfigured, sendPush, type PushSubscriptionRecord } from "@/lib/push";

// 로그인 사용자 본인에게 테스트 알림 발송
export async function POST() {
  if (!isPushConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  const { data: subscriptions } = await admin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .eq("user_id", user.id)
    .returns<PushSubscriptionRecord[]>();

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ error: "no_subscription" }, { status: 404 });
  }

  const payload = {
    title: "모두의 모임",
    body: "알림이 정상적으로 연결됐어요! 🎉",
    url: "/mypage",
  };

  let sent = 0;
  const expiredEndpoints: string[] = [];
  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, payload);
    if (result.ok) sent += 1;
    if (result.expired) expiredEndpoints.push(subscription.endpoint);
  }

  // 만료된 구독 정리
  if (expiredEndpoints.length > 0) {
    await admin.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  return NextResponse.json({ ok: true, sent });
}
