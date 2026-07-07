import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";

// 가상구매 설정 (성비 조절) — 손님에게 실구매와 합산되어 보임
//   PATCH { meetingId, male, female }
export async function PATCH(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { meetingId?: string; male?: number; female?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.meetingId) {
    return NextResponse.json({ error: "meeting_required" }, { status: 400 });
  }
  const male = Number(body.male);
  const female = Number(body.female);
  if (
    !Number.isInteger(male) ||
    !Number.isInteger(female) ||
    male < 0 ||
    female < 0 ||
    male > 500 ||
    female > 500
  ) {
    return NextResponse.json({ error: "invalid_counts" }, { status: 400 });
  }

  const { error } = await admin
    .from("meetings")
    .update({ virtual_male: male, virtual_female: female })
    .eq("id", body.meetingId);
  if (error) {
    return NextResponse.json({ error: "update_failed", detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
