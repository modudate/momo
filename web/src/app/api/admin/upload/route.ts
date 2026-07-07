import { NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_URL } from "@/lib/supabase/config";

const MAX_SIZE = 12 * 1024 * 1024; // 12MB (압축 전 원본 기준)
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_WIDTH = 1600; // 모바일 웹 기준 충분한 해상도

// 이미지 업로드 (관리자) — multipart/form-data { file, folder? } → 공개 URL
export async function POST(req: Request) {
  if (!(await isAdminAllowed())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const admin = getAdminClient();
  if (!admin) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }

  const folderRaw = String(form.get("folder") ?? "misc");
  const folder = /^[a-z0-9-]{1,32}$/.test(folderRaw) ? folderRaw : "misc";
  const path = `${folder}/${crypto.randomUUID()}.webp`;

  // 서버에서 리사이즈 + WebP 압축 (로딩 속도)
  const input = Buffer.from(await file.arrayBuffer());
  let bytes: Buffer;
  try {
    bytes = await sharp(input, { animated: file.type === "image/gif" })
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  const { error } = await admin.storage.from("images").upload(path, bytes, {
    contentType: "image/webp",
    upsert: false,
    cacheControl: "31536000", // 파일명이 UUID라 1년 캐시 안전
  });
  if (error) {
    return NextResponse.json({ error: "upload_failed", detail: error.message }, { status: 500 });
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/images/${path}`;
  return NextResponse.json({ ok: true, url });
}
