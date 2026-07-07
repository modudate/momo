import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

// 성비 임시마감 / 재오픈 — 일정별 남/여 신청 차단 토글
//   PATCH { meetingId, gender: "male" | "female", closed: boolean }
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { meetingId?: string; gender?: string; closed?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.meetingId || (body.gender !== "male" && body.gender !== "female")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof body.closed !== "boolean") {
    return NextResponse.json({ error: "closed_invalid" }, { status: 400 });
  }

  const col = body.gender === "male" ? "closed_male" : "closed_female";
  const { error } = await admin
    .from("meetings")
    .update({ [col]: body.closed })
    .eq("id", body.meetingId);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
