import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

type Row = { id: string; name: string | null; phone: string; memo: string | null; created_at: string };

// 블랙리스트 목록
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data } = await admin
    .from("blacklist")
    .select("id,name,phone,memo,created_at")
    .order("created_at", { ascending: false })
    .returns<Row[]>();
  return NextResponse.json({ blacklist: data ?? [] });
}

// 블랙리스트 등록
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { name?: string; phone?: string; memo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.phone || !body.phone.trim()) {
    return NextResponse.json({ error: "phone_required" }, { status: 400 });
  }

  const { error } = await admin.from("blacklist").insert({
    name: body.name?.trim() || null,
    phone: body.phone.trim(),
    memo: body.memo?.trim() || null,
  });
  if (error) {
    return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// 블랙리스트 삭제 — /api/admin/blacklist?id=xxx
export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await admin.from("blacklist").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
