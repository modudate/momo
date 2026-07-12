import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

// 홈 카테고리(노출 섹션) 관리 — 추가·이름수정·삭제·순서
type SectionBody = {
  key?: string;
  title?: string;
  cardLabel?: string;
  sort?: number;
};

export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data } = await admin
    .from("home_sections")
    .select("key,title,card_label,sort")
    .order("sort", { ascending: true });
  return NextResponse.json({ sections: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: SectionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const key = (body.key ?? "").trim().toLowerCase();
  const title = (body.title ?? "").trim();
  if (!/^[a-z0-9-]{2,24}$/.test(key)) {
    return NextResponse.json({ error: "key_invalid" }, { status: 400 });
  }
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

  const { error } = await admin.from("home_sections").insert({
    key,
    title,
    card_label: (body.cardLabel ?? "").trim(),
    sort: body.sort ?? 99,
  });
  if (error) {
    const duplicated = error.code === "23505";
    return NextResponse.json(
      { error: duplicated ? "key_exists" : "create_failed", detail: error.message },
      { status: duplicated ? 409 : 500 },
    );
  }
  return NextResponse.json({ ok: true, key });
}

export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: SectionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.key) return NextResponse.json({ error: "key_required" }, { status: 400 });

  const { error } = await admin
    .from("home_sections")
    .update({
      ...(body.title !== undefined ? { title: body.title.trim() } : {}),
      ...(body.cardLabel !== undefined ? { card_label: body.cardLabel.trim() } : {}),
      ...(body.sort !== undefined ? { sort: body.sort } : {}),
    })
    .eq("key", body.key);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// 삭제 — 이 카테고리를 쓰는 상품이 있으면 막고, 먼저 상품에서 해제하도록 안내
export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const key = new URL(req.url).searchParams.get("key");
  if (!key) return NextResponse.json({ error: "key_required" }, { status: 400 });

  const { count } = await admin
    .from("moim_templates")
    .select("id", { count: "exact", head: true })
    .eq("home_section", key);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: "in_use", count }, { status: 409 });
  }

  const { error } = await admin.from("home_sections").delete().eq("key", key);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
