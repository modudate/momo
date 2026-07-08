import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

export type DetailBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "html"; html: string };

function isValidBlocks(v: unknown): v is DetailBlock[] {
  if (!Array.isArray(v) || v.length > 200) return false;
  return v.every(
    (b) =>
      b &&
      typeof b === "object" &&
      (((b as { type?: string }).type === "text" && typeof (b as { text?: unknown }).text === "string") ||
        ((b as { type?: string }).type === "image" && typeof (b as { url?: unknown }).url === "string") ||
        ((b as { type?: string }).type === "html" &&
          typeof (b as { html?: unknown }).html === "string" &&
          ((b as { html: string }).html.length <= 500_000))),
  );
}

// 에디터 HTML 정리 — 스크립트류 제거 (작성자는 관리자뿐이지만 방어적으로)
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\/?(script|style|iframe|object|embed|link|meta)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi, "");
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
  const detail = body.detail.map((b) =>
    b.type === "html" ? { ...b, html: sanitizeHtml(b.html) } : b,
  );

  const { error } = await admin
    .from("moim_templates")
    .update({ detail })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: "save_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
