import { NextResponse } from "next/server";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_URL } from "@/lib/supabase/config";

// 브라우저 → 버킷 직접 업로드용 서명 URL 발급 (관리자만)
//  · 파일이 서버(Vercel)를 거치지 않으므로 요청 본문 4.5MB 제한을 받지 않는다.
//  · 서버는 "권한 확인 + 업로드 티켓 발급"만 한다.
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let body: { folder?: string; ext?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const folder = /^[a-z0-9-]{1,32}$/.test(body.folder ?? "") ? body.folder! : "misc";
  const ext = /^(webp|jpg|jpeg|png|gif)$/.test(body.ext ?? "") ? body.ext! : "webp";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { data, error } = await admin.storage.from("images").createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json({ error: "sign_failed", detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({
    path: data.path,
    token: data.token,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/images/${path}`,
  });
}
