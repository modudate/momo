import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const [templates, upcomingSessions, orders, subscribers] = await Promise.all([
    admin.from("moim_templates").select("*", { count: "exact", head: true }),
    admin.from("meetings").select("*", { count: "exact", head: true }).gte("date", todayIso),
    admin.from("orders").select("*", { count: "exact", head: true }),
    admin.from("push_subscriptions").select("*", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    templates: templates.count ?? 0,
    upcomingSessions: upcomingSessions.count ?? 0,
    orders: orders.count ?? 0,
    subscribers: subscribers.count ?? 0,
  });
}
