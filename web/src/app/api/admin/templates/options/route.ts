import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

type OptionBody = {
  id?: string;
  templateId?: string;
  label?: string;
  gender?: string;
  ageGroup?: string;
  price?: number;
  capacity?: number;
  sort?: number;
};

export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const templateId = new URL(req.url).searchParams.get("templateId");
  if (!templateId) return NextResponse.json({ error: "template_required" }, { status: 400 });

  const { data } = await admin
    .from("template_options")
    .select("id,label,gender,age_group,price,capacity,sort")
    .eq("template_id", templateId)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  return NextResponse.json({ options: data ?? [] });
}

export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: OptionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.templateId || !body.label) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const id = `opt-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await admin.from("template_options").insert({
    id,
    template_id: body.templateId,
    label: body.label,
    gender: body.gender ?? "any",
    age_group: body.ageGroup ?? "",
    price: body.price ?? 0,
    // 0 = 옵션별 정원 없음 (상품 전체 정원만 적용)
    capacity: body.capacity ?? 0,
    sort: body.sort ?? 0,
  });
  if (error) return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: OptionBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await admin
    .from("template_options")
    .update({
      label: body.label,
      gender: body.gender,
      age_group: body.ageGroup,
      price: body.price,
      capacity: body.capacity,
    })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: "update_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const optionId = new URL(req.url).searchParams.get("id");
  if (!optionId) return NextResponse.json({ error: "id_required" }, { status: 400 });

  const { error } = await admin.from("template_options").delete().eq("id", optionId);
  if (error) return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
