import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify";

// 후기 — 목록(공개) / 작성(예약 1건당 1개)

type DbReview = {
  id: string;
  user_id: string;
  order_id: string;
  content: string;
  created_at: string;
};

// 작성자 표기: 이름 첫 글자만 노출 (김**)
function maskName(name: string | null | undefined): string {
  const n = (name ?? "").trim();
  if (!n) return "익명";
  return n.length === 1 ? n : `${n.slice(0, 1)}${"*".repeat(Math.min(n.length - 1, 2))}`;
}

export async function GET(req: Request) {
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ reviews: [], total: 0 });

  const url = new URL(req.url);
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 20), 1), 50);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

  const { data: reviews, count } = await admin
    .from("reviews")
    .select("id,user_id,order_id,content,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)
    .returns<DbReview[]>();

  const rows = reviews ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ reviews: [], total: count ?? 0 });
  }

  const reviewIds = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const [{ data: reactions }, { data: profiles }, user] = await Promise.all([
    admin
      .from("review_reactions")
      .select("review_id,user_id,kind")
      .in("review_id", reviewIds)
      .returns<{ review_id: string; user_id: string; kind: "up" | "down" }[]>(),
    admin
      .from("profiles")
      .select("id,name")
      .in("id", userIds)
      .returns<{ id: string; name: string | null }[]>(),
    getServerUser(),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name]));
  const tally = new Map<string, { up: number; down: number; mine: "up" | "down" | null }>();
  (reactions ?? []).forEach((r) => {
    const cur = tally.get(r.review_id) ?? { up: 0, down: 0, mine: null };
    if (r.kind === "up") cur.up += 1;
    else cur.down += 1;
    if (user && r.user_id === user.id) cur.mine = r.kind;
    tally.set(r.review_id, cur);
  });

  return NextResponse.json({
    total: count ?? rows.length,
    reviews: rows.map((r) => {
      const t = tally.get(r.id) ?? { up: 0, down: 0, mine: null };
      return {
        id: r.id,
        author: maskName(nameById.get(r.user_id)),
        content: r.content,
        created_at: r.created_at,
        up: t.up,
        down: t.down,
        myReaction: t.mine,
        isMine: user ? r.user_id === user.id : false,
      };
    }),
  });
}

// 후기 작성 — 내 예약(주문) 1건당 1개
export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { orderId?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const content = (body.content ?? "").trim();
  if (!body.orderId) return NextResponse.json({ error: "order_required" }, { status: 400 });
  if (content.length < 5 || content.length > 2000) {
    return NextResponse.json({ error: "content_invalid" }, { status: 400 });
  }

  // 내 예약이 맞고, 취소/실패 건이 아닌지 확인
  const { data: order } = await admin
    .from("orders")
    .select("id,user_id,status")
    .eq("id", body.orderId)
    .maybeSingle<{ id: string; user_id: string | null; status: string }>();
  if (!order || order.user_id !== user.id) {
    return NextResponse.json({ error: "order_not_found" }, { status: 404 });
  }
  if (order.status === "cancelled" || order.status === "failed") {
    return NextResponse.json({ error: "order_not_eligible" }, { status: 409 });
  }

  // order_id unique 제약이 "예약 1건 = 후기 1개"를 보장
  const { error } = await admin
    .from("reviews")
    .insert({ user_id: user.id, order_id: order.id, content });
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
    }
    return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  }

  void notifyAdmins("📝 새 후기", content.slice(0, 60), "/admin?tab=reviews");
  return NextResponse.json({ ok: true });
}
