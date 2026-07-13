"use client";

// 업로드 전 브라우저에서 이미지 축소·재인코딩.
//  · 서버(Vercel)는 요청 본문이 4.5MB를 넘으면 함수에 닿기도 전에 잘라낸다(FUNCTION_PAYLOAD_TOO_LARGE).
//    → 원본이 몇십 MB여도 여기서 줄여 보내면 용량 제한 없이 올릴 수 있다.
//  · 가로세로 비율은 절대 바꾸지 않는다 (한 배율로만 축소).

const MAX_WIDTH = 1600; // 상세 이미지 표시 폭 기준 충분한 해상도
const MAX_HEIGHT = 16000; // WebP 인코딩 한계(16383)보다 아래로
const TARGET_BYTES = 3 * 1024 * 1024; // 3MB 이하로 맞춘다 (4.5MB 한도에 여유)

function rename(name: string, ext: string) {
  return `${name.replace(/\.[^.]+$/, "") || "image"}.${ext}`;
}

export async function compressImage(file: File): Promise<File> {
  // 움직이는 GIF는 캔버스로 다시 그리면 애니메이션이 사라지므로 원본 유지
  if (file.type === "image/gif") return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file; // 디코딩 실패 시 원본 그대로 (서버가 판단)
  }

  // 원본 비율 유지: 가로/세로에 같은 배율만 적용하고, 확대는 하지 않음
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

  // 목표 용량에 들 때까지 화질을 단계적으로 낮춘다
  for (const quality of [0.9, 0.8, 0.65, 0.5]) {
    const blob = await toBlob("image/webp", quality);
    if (blob && blob.size <= TARGET_BYTES) {
      return new File([blob], rename(file.name, "webp"), { type: "image/webp" });
    }
  }

  // WebP를 못 만드는 브라우저 대비
  const jpeg = await toBlob("image/jpeg", 0.8);
  if (jpeg && jpeg.size < file.size) {
    return new File([jpeg], rename(file.name, "jpg"), { type: "image/jpeg" });
  }
  return file;
}
