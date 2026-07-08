import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // 관리자·API·개인 페이지는 검색 노출 제외
        disallow: ["/admin", "/api/", "/mypage"],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
