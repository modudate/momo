// public 이미지 일괄 WebP 압축 (1회성)
// 사용: node scripts/optimize-images.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const jobs = [
  // [원본, 출력, 최대 가로폭]
  ["public/regions/gangnam.png", "public/regions/gangnam.webp", 760],
  ["public/regions/hongdae.png", "public/regions/hongdae.webp", 760],
  ["public/regions/suwon.png", "public/regions/suwon.webp", 760],
  ["public/cta-faq.png", "public/cta-faq.webp", 1080],
  ["public/cta-worry.png", "public/cta-worry.webp", 1080],
  ["public/moso-hero.png", "public/moso-hero.webp", 1080],
  ["public/moso-mood-bar.png", "public/moso-mood-bar.webp", 1080],
  ["public/moso-mood-class.png", "public/moso-mood-class.webp", 1080],
];

for (const [src, out, width] of jobs) {
  if (!fs.existsSync(src)) {
    console.log(`skip (없음): ${src}`);
    continue;
  }
  const before = fs.statSync(src).size;
  await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
  const after = fs.statSync(out).size;
  console.log(
    `${path.basename(src)} ${(before / 1024).toFixed(0)}KB → ${path.basename(out)} ${(after / 1024).toFixed(0)}KB`,
  );
}
