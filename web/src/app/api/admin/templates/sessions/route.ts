import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

const CATEGORY_TAG: Record<string, string> = {
  wine: "와인",
  coffee: "커피",
  popular: "인기남녀",
  premium: "프리미엄",
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

// 특정 상품의 일정(세션) 목록
export async function GET(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const templateId = new URL(req.url).searchParams.get("templateId");
  if (!templateId) {
    return NextResponse.json({ error: "template_required" }, { status: 400 });
  }
  const { data: sessions } = await supabaseAdmin
    .from("meetings")
    .select("id,date,time,capacity")
    .eq("template_id", templateId)
    .order("date", { ascending: true })
    .order("time", { ascending: true })
    .returns<{ id: string; date: string; time: string; capacity: number }[]>();

  // 신청 수는 orders에서 동적 계산 (meetings.joined 컬럼은 갱신되지 않음)
  const ids = (sessions ?? []).map((s) => s.id);
  const countMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("meeting_id")
      .in("meeting_id", ids)
      .neq("status", "cancelled")
      .returns<{ meeting_id: string }[]>();
    (orders ?? []).forEach((o) =>
      countMap.set(o.meeting_id, (countMap.get(o.meeting_id) ?? 0) + 1),
    );
  }

  return NextResponse.json({
    sessions: (sessions ?? []).map((s) => ({ ...s, joined: countMap.get(s.id) ?? 0 })),
  });
}

type GenerateBody = {
  templateId?: string;
  slots?: { date: string; time: string }[];
};

// 일정 생성 — 달력/정기 선택으로 만든 (date,time) 목록을 받아 세션 일괄 생성
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: GenerateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.templateId || !body.slots || body.slots.length === 0) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const { data: template } = await supabaseAdmin
    .from("moim_templates")
    .select("id,category,region_slug,age_group,title,description,place,price,capacity,image")
    .eq("id", body.templateId)
    .single<DbTemplate>();
  if (!template) {
    return NextResponse.json({ error: "template_not_found" }, { status: 404 });
  }

  // 이미 있는 (date,time) 은 건너뜀
  const { data: existing } = await supabaseAdmin
    .from("meetings")
    .select("date,time")
    .eq("template_id", template.id)
    .returns<{ date: string; time: string }[]>();
  const existingKeys = new Set((existing ?? []).map((row) => `${row.date} ${row.time}`));

  const categoryTag = CATEGORY_TAG[template.category] ?? "모임";
  const tag =
    template.age_group && template.age_group !== "전연령"
      ? `${categoryTag}·${template.age_group}`
      : categoryTag;

  const rows = body.slots
    .filter((slot) => slot.date && slot.time && !existingKeys.has(`${slot.date} ${slot.time}`))
    .map((slot) => ({
      id: `s-${crypto.randomUUID().slice(0, 10)}`,
      template_id: template.id,
      region_slug: template.region_slug,
      date: slot.date,
      time: slot.time,
      title: template.title,
      tag,
      price: template.price,
      capacity: template.capacity,
      joined: 0,
      image: template.image,
      description: template.description,
      place: template.place,
    }));

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, created: 0 });
  }

  const { error } = await supabaseAdmin.from("meetings").insert(rows);
  if (error) {
    return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created: rows.length });
}

// 일정(세션) 삭제
export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const sessionId = new URL(req.url).searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("meetings").delete().eq("id", sessionId);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
