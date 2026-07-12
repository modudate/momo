import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

type DbReview = {
  id: string;
  user_id: string;
  order_id: string;
  content: string;
  created_at: string;
};

// 관리자 — 후기 목록 + 삭제 (부적절·테러성 글 제거)
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: reviews } = await admin
    .from("reviews")
    .select("id,user_id,order_id,content,created_at")
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<DbReview[]>();

  const rows = reviews ?? [];
  if (rows.length === 0) return NextResponse.json({ reviews: [] });

  const [{ data: profiles }, { data: reactions }, { data: orders }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,name,phone")
      .in("id", [...new Set(rows.map((r) => r.user_id))])
      .returns<{ id: string; name: string | null; phone: string | null }[]>(),
    admin
      .from("review_reactions")
      .select("review_id,kind")
      .in(
        "review_id",
        rows.map((r) => r.id),
      )
      .returns<{ review_id: string; kind: "up" | "down" }[]>(),
    admin
      .from("orders")
      .select("id,meetings(title,date)")
      .in(
        "id",
        rows.map((r) => r.order_id),
      )
      .returns<{ id: string; meetings: { title: string; date: string } | null }[]>(),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const orderById = new Map((orders ?? []).map((o) => [o.id, o.meetings]));
  const tally = new Map<string, { up: number; down: number }>();
  (reactions ?? []).forEach((r) => {
    const cur = tally.get(r.review_id) ?? { up: 0, down: 0 };
    if (r.kind === "up") cur.up += 1;
    else cur.down += 1;
    tally.set(r.review_id, cur);
  });

  return NextResponse.json({
    reviews: rows.map((r) => {
      const p = profileById.get(r.user_id);
      const m = orderById.get(r.order_id);
      const t = tally.get(r.id) ?? { up: 0, down: 0 };
      return {
        id: r.id,
        content: r.content,
        created_at: r.created_at,
        name: p?.name ?? "-",
        phone: p?.phone ?? "",
        meeting: m ? `${m.title} (${m.date})` : "-",
        up: t.up,
        down: t.down,
      };
    }),
  });
}

export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await admin.from("reviews").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
