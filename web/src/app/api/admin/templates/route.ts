import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

type TemplateBody = {
  id?: string;
  category?: string;
  regionSlug?: string;
  ageGroup?: string;
  title?: string;
  description?: string;
  place?: string;
  price?: number;
  capacity?: number;
  image?: string;
  homeSection?: string; // "" | "signature" | "premium"
  homeBadge?: string; // 홈 카드 검정 뱃지 문구
  duplicateFrom?: string; // 복제 원본 템플릿 id
};

type DbTemplate = {
  id: string;
  category: string;
  region_slug: string;
  age_group: string;
  title: string;
  description: string | null;
  place: string | null;
  price: number;
  capacity: number;
  image: string | null;
};

// 상품(템플릿) 목록
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { data: templates } = await supabaseAdmin
    .from("moim_templates")
    .select(
      "id,category,region_slug,age_group,title,description,place,price,capacity,image,home_section,home_badge",
    )
    .order("created_at", { ascending: false });
  return NextResponse.json({ templates: templates ?? [] });
}

// 상품 생성 (복제 포함)
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: TemplateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  // 복제: 원본을 불러와 기본값으로 채움 (body 값이 있으면 덮어씀)
  let base: Partial<DbTemplate> = {};
  if (body.duplicateFrom) {
    const { data: source } = await supabaseAdmin
      .from("moim_templates")
      .select("category,region_slug,age_group,title,description,place,price,capacity,image")
      .eq("id", body.duplicateFrom)
      .single<DbTemplate>();
    if (source) base = source;
  }

  const category = body.category ?? base.category ?? "wine";
  const regionSlug = body.regionSlug ?? base.region_slug;
  const title = body.title ?? base.title;
  if (!regionSlug || !title) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const id = `tpl-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabaseAdmin.from("moim_templates").insert({
    id,
    category,
    region_slug: regionSlug,
    age_group: body.ageGroup ?? base.age_group ?? "전연령",
    title,
    description: body.description ?? base.description ?? null,
    place: body.place ?? base.place ?? null,
    price: body.price ?? base.price ?? 0,
    capacity: body.capacity ?? base.capacity ?? 16,
    image: body.image || base.image || `https://picsum.photos/seed/${id}/800/600`,
    home_section: body.homeSection || null,
    home_badge: body.homeBadge?.trim() || null,
  });
  if (error) {
    return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}

// 상품 수정
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  let body: TemplateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("moim_templates")
    .update({
      category: body.category,
      region_slug: body.regionSlug,
      age_group: body.ageGroup,
      title: body.title,
      description: body.description ?? null,
      place: body.place ?? null,
      price: body.price,
      capacity: body.capacity,
      ...(body.image ? { image: body.image } : {}),
      home_section: body.homeSection || null,
      home_badge: body.homeBadge?.trim() || null,
    })
    .eq("id", body.id);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// 상품 삭제 (생성된 일정도 함께 삭제)
export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const templateId = new URL(req.url).searchParams.get("id");
  if (!templateId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  await supabaseAdmin.from("meetings").delete().eq("template_id", templateId);
  const { error } = await supabaseAdmin.from("moim_templates").delete().eq("id", templateId);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
