"use client";

import { getBrowserClient } from "@/lib/supabase/browser";
import { compressImage } from "@/lib/compressImage";

// 관리자 이미지 업로드 (브라우저 → 스토리지 버킷 직접)
//  1) 브라우저에서 축소·압축 (원본 비율 유지) — 로딩 속도용
//  2) 서버에서 서명 URL만 받아 버킷으로 바로 업로드
//     → 파일이 서버를 거치지 않으므로 용량 제한(4.5MB)에 걸리지 않는다
//  3) 서명 업로드가 안 되는 환경이면 기존 서버 업로드로 폴백
export async function uploadImage(file: File, folder: string): Promise<string> {
  const compressed = await compressImage(file);

  try {
    const ext = compressed.type === "image/gif" ? "gif" : compressed.type === "image/jpeg" ? "jpg" : "webp";
    const res = await fetch("/api/admin/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder, ext }),
    });
    if (!res.ok) throw new Error("sign_failed");
    const { path, token, publicUrl } = (await res.json()) as {
      path: string;
      token: string;
      publicUrl: string;
    };

    const supabase = getBrowserClient();
    if (!supabase) throw new Error("no_client");

    const { error } = await supabase.storage
      .from("images")
      .uploadToSignedUrl(path, token, compressed, {
        contentType: compressed.type,
        cacheControl: "31536000", // 파일명이 UUID라 1년 캐시 안전
      });
    if (error) throw error;

    return publicUrl;
  } catch {
    // 폴백: 서버 경유 업로드 (압축 후라 대부분 한도 안에 들어옴)
    const fd = new FormData();
    fd.append("file", compressed);
    fd.append("folder", folder);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "upload_failed");
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  }
}
