import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

const VALID_KEY = /^[a-z0-9-]{1,40}$/;

// 사이트 콘텐츠 조회 (관리자) — /api/admin/site-content?key=hero
export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!VALID_KEY.test(key)) {
    return NextResponse.json({ error: "key_invalid" }, { status: 400 });
  }
  const { data } = await admin
    .from("site_content")
    .select("value")
    .eq("key", key)
    .maybeSingle<{ value: unknown }>();
  return NextResponse.json({ key, value: data?.value ?? null });
}

// 사이트 콘텐츠 저장 (관리자) — PUT { key, value }
export async function PUT(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { key?: string; value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.key || !VALID_KEY.test(body.key) || body.value === undefined) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { error } = await admin
    .from("site_content")
    .upsert({ key: body.key, value: body.value, updated_at: new Date().toISOString() });
  if (error) {
    return NextResponse.json({ error: "save_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
