import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { isPushConfigured, sendPush, type PushSubscriptionRecord } from "@/lib/push";

type BroadcastBody = { title?: string; body?: string; url?: string };

// 전체 구독자에게 푸시 발송 (관리자)
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!isPushConfigured) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: BroadcastBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const title = body.title?.trim();
  const messageBody = body.body?.trim();
  if (!title || !messageBody) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data: subscriptions } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint,p256dh,auth")
    .returns<PushSubscriptionRecord[]>();

  if (!subscriptions || subscriptions.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, total: 0 });
  }

  const payload = { title, body: messageBody, url: body.url || "/home" };
  let sent = 0;
  const expiredEndpoints: string[] = [];

  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, payload);
    if (result.ok) sent += 1;
    if (result.expired) expiredEndpoints.push(subscription.endpoint);
  }

  if (expiredEndpoints.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expiredEndpoints);
  }

  return NextResponse.json({ ok: true, sent, total: subscriptions.length });
}
