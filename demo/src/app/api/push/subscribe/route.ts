import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerUser } from "@/lib/supabase/server";

type SubscribeBody = {
  subscription?: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
};

// 브라우저 푸시 구독 정보를 저장
export async function POST(req: Request) {
  let body: SubscribeBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const subscription = body.subscription;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const user = await getServerUser();
  const userAgent = req.headers.get("user-agent") ?? null;

  const { error } = await admin.from("push_subscriptions").upsert(
    {
      endpoint,
      p256dh,
      auth,
      user_id: user?.id ?? null,
      user_agent: userAgent,
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
