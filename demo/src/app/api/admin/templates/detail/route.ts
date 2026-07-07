import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export type DetailBlock = { type: "text"; text: string } | { type: "image"; url: string };

function isValidBlocks(v: unknown): v is DetailBlock[] {
  if (!Array.isArray(v) || v.length > 200) return false;
  return v.every(
    (b) =>
      b &&
      typeof b === "object" &&
      (((b as { type?: string }).type === "text" && typeof (b as { text?: unknown }).text === "string") ||
        ((b as { type?: string }).type === "image" && typeof (b as { url?: unknown }).url === "string")),
  );
}

// 상품 상세 블록 조회 — /api/admin/templates/detail?id=tpl-xxx
export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { data } = await admin
    .from("moim_templates")
    .select("detail")
    .eq("id", id)
    .maybeSingle<{ detail: DetailBlock[] }>();
  return NextResponse.json({ detail: data?.detail ?? [] });
}

// 상품 상세 블록 저장 — PUT { id, detail: DetailBlock[] }
export async function PUT(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { id?: string; detail?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  if (!isValidBlocks(body.detail)) {
    return NextResponse.json({ error: "detail_invalid" }, { status: 400 });
  }

  const { error } = await admin
    .from("moim_templates")
    .update({ detail: body.detail })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: "save_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
