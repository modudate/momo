import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify";

// 1:1 문의 — 내 문의 목록 조회 / 새 문의 작성 (로그인 필요)

type InquiryRow = {
  id: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
};

export async function GET() {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const { data } = await admin
    .from("inquiries")
    .select("id,title,content,status,answer,answered_at,created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .returns<InquiryRow[]>();

  return NextResponse.json({ inquiries: data ?? [] });
}

export async function POST(req: Request) {
  const user = await getServerUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { title?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const title = (body.title ?? "").trim().slice(0, 120);
  const content = (body.content ?? "").trim().slice(0, 5000);
  if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });
  if (!content) return NextResponse.json({ error: "content_required" }, { status: 400 });

  const { data, error } = await admin
    .from("inquiries")
    .insert({ user_id: user.id, title, content })
    .select("id")
    .single<{ id: string }>();

  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });

  void notifyAdmins("📩 새 1:1 문의", `${title} · ${user.email ?? ""}`);
  return NextResponse.json({ ok: true, id: data.id });
}
