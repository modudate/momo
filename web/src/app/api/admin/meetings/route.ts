import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

// 모임 목록 조회 (관리자)
export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { data: meetings } = await supabaseAdmin
    .from("meetings")
    .select("id,region_slug,date,time,end_time,hidden,title,tag,price,capacity,joined,description,place")
    .order("date", { ascending: true });
  return NextResponse.json({ meetings: meetings ?? [] });
}

type CreateBody = {
  regionSlug?: string;
  date?: string;
  time?: string;
  endTime?: string; // HH:mm — 지나면 손님 화면에서 자동으로 사라짐
  hidden?: boolean; // 관리자 강제 숨김
  title?: string;
  tag?: string;
  price?: number;
  capacity?: number;
  image?: string;
  description?: string;
  place?: string;
};

// 모임 등록 (관리자)
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: CreateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const { regionSlug, date, time, endTime, title, tag, price, capacity, image, description, place } =
    body;
  if (!regionSlug || !date || !time || !title || price == null || capacity == null) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const id = `${regionSlug}-${crypto.randomUUID().slice(0, 8)}`;
  const { error } = await supabaseAdmin.from("meetings").insert({
    id,
    region_slug: regionSlug,
    date,
    time,
    end_time: endTime || null,
    title,
    tag: tag || "정기모임",
    price,
    capacity,
    joined: 0,
    image: image || `https://picsum.photos/seed/${id}/800/600`,
    description: description ?? null,
    place: place ?? null,
  });

  if (error) {
    return NextResponse.json({ error: "create_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}

type UpdateBody = CreateBody & { id?: string };

// 모임 수정 (관리자)
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  let body: UpdateBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }

  // hidden만 보내면(강제 숨김 토글) 그 필드만 갱신
  const patch: Record<string, unknown> =
    body.regionSlug === undefined && body.hidden !== undefined
      ? { hidden: body.hidden }
      : {
          region_slug: body.regionSlug,
          date: body.date,
          time: body.time,
          end_time: body.endTime || null,
          title: body.title,
          tag: body.tag || "정기모임",
          price: body.price,
          capacity: body.capacity,
          description: body.description ?? null,
          place: body.place ?? null,
          ...(body.hidden !== undefined ? { hidden: body.hidden } : {}),
        };

  const { error } = await supabaseAdmin.from("meetings").update(patch).eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// 모임 삭제 (관리자) — /api/admin/meetings?id=xxx
export async function DELETE(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const meetingId = new URL(req.url).searchParams.get("id");
  if (!meetingId) {
    return NextResponse.json({ error: "id_required" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("meetings").delete().eq("id", meetingId);
  if (error) {
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
