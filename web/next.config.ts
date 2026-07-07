import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 정적 이미지 — 브라우저 1일 + CDN 7일 캐시 (재방문 즉시 표시)
        source: "/:path*.(webp|png|jpg|jpeg|gif|svg|ico)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
