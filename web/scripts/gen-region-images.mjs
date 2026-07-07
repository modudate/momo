// 지역 홈 타일 이미지 생성 (Gemini 3.1 Flash Image / Nano Banana 2)
// 키는 스크래치패드 파일에서 읽음(로그 노출 방지). 결과 PNG → public/regions/
import fs from "node:fs";
import path from "node:path";

const KEY_FILE = process.argv[2];
const key = fs.readFileSync(KEY_FILE, "utf8").trim();
const MODEL = "gemini-3.1-flash-image";
const outDir = path.resolve(process.cwd(), "public/regions");

const regions = [
  {
    slug: "gangnam",
    prompt:
      "Photorealistic vertical (portrait, 3:4) nighttime street scene of Gangnam, Seoul. Sleek modern high-rise buildings, glowing neon and LED signage, warm bokeh city lights, stylish upscale trendy atmosphere, cinematic color grading, shallow depth of field. Absolutely no text, no letters, no words, no watermark.",
  },
  {
    slug: "hongdae",
    prompt:
      "Photorealistic vertical (portrait, 3:4) lively nightlife street in Hongdae, Seoul. Youthful energetic vibe, colorful murals and street art, indie bars and cafes, warm string lights and neon, artsy bohemian mood, cinematic. Absolutely no text, no letters, no words, no watermark.",
  },
  {
    slug: "suwon",
    prompt:
      "Photorealistic vertical (portrait, 3:4) evening scene of Suwon, South Korea. Illuminated Hwaseong Fortress stone wall at blue-hour dusk blended with soft modern city lights, warm calm romantic atmosphere, cinematic. Absolutely no text, no letters, no words, no watermark.",
  },
];

async function gen(r) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: r.prompt }] }],
    generationConfig: {
      responseModalities: ["IMAGE"],
      imageConfig: { aspectRatio: "3:4" },
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`[${r.slug}] HTTP ${res.status}:`, JSON.stringify(json).slice(0, 400));
    return false;
  }
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const data = imgPart?.inlineData?.data || imgPart?.inline_data?.data;
  if (!data) {
    console.error(`[${r.slug}] no image in response:`, JSON.stringify(json).slice(0, 400));
    return false;
  }
  const buf = Buffer.from(data, "base64");
  const out = path.join(outDir, `${r.slug}.png`);
  fs.writeFileSync(out, buf);
  console.log(`[${r.slug}] saved ${out} (${Math.round(buf.length / 1024)} KB)`);
  return true;
}

for (const r of regions) {
  await gen(r);
}
