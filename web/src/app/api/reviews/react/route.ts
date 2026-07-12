import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

// 후기 반응 (좋아요/싫어요) — 한 후기에 한 사람이 1회만
//  같은 걸 다시 누르면 취소, 다른 걸 누르면 변경 (PK가 1인 1회를 강제)
export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { reviewId?: string; kind?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const kind = body.kind === "up" || body.kind === "down" ? body.kind : null;
  if (!body.reviewId || !kind) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: existing } = await admin
    .from("review_reactions")
    .select("kind")
    .eq("review_id", body.reviewId)
    .eq("user_id", user.id)
    .maybeSingle<{ kind: "up" | "down" }>();

  if (existing?.kind === kind) {
    // 같은 걸 다시 누름 → 취소
    await admin
      .from("review_reactions")
      .delete()
      .eq("review_id", body.reviewId)
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true, myReaction: null });
  }

  const { error } = await admin
    .from("review_reactions")
    .upsert(
      { review_id: body.reviewId, user_id: user.id, kind },
      { onConflict: "review_id,user_id" },
    );
  if (error) {
    return NextResponse.json({ error: "react_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, myReaction: kind });
}
