import { NextResponse } from "next/server";
import sharp from "sharp";
import { isAdminAllowed } from "@/lib/admin";
import { getAdminClient } from "@/lib/supabase/admin";
import { SUPABASE_URL } from "@/lib/supabase/config";

// 참고: 이 경로는 폴백용. 기본은 브라우저 → 버킷 직접 업로드(/api/admin/upload-url)라
// 용량 제한이 없다. 여기로 오는 파일은 Vercel 요청 본문 한도(4.5MB) 안이어야 한다.
const MAX_SIZE = 4 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_WIDTH = 1600; // 모바일 웹 기준 충분한 해상도
const WEBP_MAX_SIDE = 16383; // WebP 인코딩 한계 — 세로로 긴 상세 이미지는 JPEG로

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

  // 서버에서 리사이즈 + 압축 (원본 비율 유지 — 가로 기준으로만 축소)
  const input = Buffer.from(await file.arrayBuffer());
  let bytes: Buffer;
  let mime = "image/webp";
  try {
    const meta = await sharp(input).metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    // 축소 후 예상 높이가 WebP 한계를 넘으면(세로로 아주 긴 상세 이미지) JPEG로 저장
    const targetWidth = width > 0 ? Math.min(width, MAX_WIDTH) : MAX_WIDTH;
    const scaledHeight = width > 0 ? Math.round(height * (targetWidth / width)) : height;
    const useJpeg = scaledHeight > WEBP_MAX_SIDE || targetWidth > WEBP_MAX_SIDE;

    const pipeline = sharp(input, { animated: file.type === "image/gif" }).resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
    });
    if (useJpeg) {
      mime = "image/jpeg";
      bytes = await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } else {
      bytes = await pipeline.webp({ quality: 80 }).toBuffer();
    }
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  const path = `${folder}/${crypto.randomUUID()}.${mime === "image/jpeg" ? "jpg" : "webp"}`;

  // Buffer를 그대로 넘기면 전송 계층에서 UTF-8로 뭉개져 파일이 깨짐 — 반드시 Blob으로
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const { error } = await admin.storage.from("images").upload(path, blob, {
    contentType: mime,
    upsert: false,
    cacheControl: "31536000", // 파일명이 UUID라 1년 캐시 안전
  });
  if (error) {
    return NextResponse.json({ error: "upload_failed", detail: error.message }, { status: 500 });
  }

  const url = `${SUPABASE_URL}/storage/v1/object/public/images/${path}`;
  return NextResponse.json({ ok: true, url });
}
