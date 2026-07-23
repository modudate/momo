import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

// 1:1 문의 관리 (관리자) — 전체 목록 조회 / 답변 남기기

type Row = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

export async function GET() {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data: rows } = await admin
    .from("inquiries")
    .select("id,user_id,title,content,status,answer,answered_at,created_at")
    .order("created_at", { ascending: false })
    .returns<Row[]>();

  const inquiries = rows ?? [];

  // 작성자 이름/이메일 붙이기 (프로필 + auth)
  const ids = [...new Set(inquiries.map((r) => r.user_id))];
  const nameById = new Map<string, { name: string | null; phone: string | null; email: string }>();
  if (ids.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id,name,phone")
      .in("id", ids)
      .returns<{ id: string; name: string | null; phone: string | null }[]>();
    for (const p of profs ?? []) nameById.set(p.id, { name: p.name, phone: p.phone, email: "" });
    // 이메일은 auth 에서
    for (const id of ids) {
      const { data } = await admin.auth.admin.getUserById(id);
      const cur = nameById.get(id) ?? { name: null, phone: null, email: "" };
      cur.email = data.user?.email ?? "";
      nameById.set(id, cur);
    }
  }

  return NextResponse.json({
    inquiries: inquiries.map((r) => ({
      ...r,
      user_name: nameById.get(r.user_id)?.name ?? "",
      user_phone: nameById.get(r.user_id)?.phone ?? "",
      user_email: nameById.get(r.user_id)?.email ?? "",
    })),
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { id?: string; answer?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const id = body.id;
  const answer = (body.answer ?? "").trim().slice(0, 5000);
  if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
  if (!answer) return NextResponse.json({ error: "answer_required" }, { status: 400 });

  const { error } = await admin
    .from("inquiries")
    .update({ answer, status: "answered", answered_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
