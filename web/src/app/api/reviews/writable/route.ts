import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

// 후기 작성 가능한 내 예약 목록 — 예약 1건당 1개, 이미 쓴 예약은 제외
export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ orders: [] });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ orders: [] });

  const { data: orders } = await admin
    .from("orders")
    .select("id,created_at,meetings(title,date,time)")
    .eq("user_id", user.id)
    .not("status", "in", "(cancelled,failed)")
    .order("created_at", { ascending: false })
    .returns<
      { id: string; created_at: string; meetings: { title: string; date: string; time: string } | null }[]
    >();

  const rows = orders ?? [];
  if (rows.length === 0) return NextResponse.json({ orders: [] });

  const { data: written } = await admin
    .from("reviews")
    .select("order_id")
    .in(
      "order_id",
      rows.map((o) => o.id),
    )
    .returns<{ order_id: string }[]>();
  const done = new Set((written ?? []).map((r) => r.order_id));

  return NextResponse.json({
    orders: rows
      .filter((o) => !done.has(o.id))
      .map((o) => ({
        id: o.id,
        title: o.meetings?.title ?? "모임",
        date: o.meetings?.date ?? "",
        time: o.meetings?.time ?? "",
      })),
  });
}
