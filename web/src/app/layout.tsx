import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr"),
  title: {
    default: "모두의 모임 — 강남·홍대·수원 오프라인 모임",
    template: "%s — 모두의 모임",
  },
  description:
    "강남·홍대·수원에서 열리는 와인·커피 오프라인 소셜 모임. 매주 화·수·목·금·토·일 연중무휴, 좋은 사람들과 함께하세요.",
  keywords: [
    "모두의 모임", "소셜 모임", "와인 모임", "커피 모임",
    "강남 모임", "홍대 모임", "수원 모임", "직장인 모임", "소개팅",
  ],
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "모두의 모임",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  // 검색엔진 소유 확인 (구글 서치콘솔 / 네이버 서치어드바이저)
  verification: {
    google: "8y2tUL0ZDIVqpg6VivIUawD81DfrcGnZgFo6t3bzAaA",
    other: { "naver-site-verification": "cd64fd695b6ecd0a7d493f09f037db19781621f5" },
  },
  // 카톡/SNS 공유 미리보기
  openGraph: {
    title: "모두의 모임",
    description: "강남·홍대·수원에서 열리는 오프라인 모임, 모두의 모임",
    siteName: "모두의 모임",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/og_image.png", width: 1731, height: 909, alt: "모두의 모임" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "모두의 모임",
    description: "강남·홍대·수원에서 열리는 오프라인 모임, 모두의 모임",
    images: ["/og_image.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#FF8A3D",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className="h-full">
      <head>
        {/* 폰트 CDN 미리 연결 + dynamic-subset(사용 글자 조각만 다운로드) → 글자 렌더 빨라짐 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 검색엔진용 구조화 데이터 (Organization + WebSite) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  name: "모두의 모임",
                  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr",
                  logo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr"}/icon-512.png`,
                  description: "강남·홍대·수원에서 열리는 와인·커피 오프라인 소셜 모임",
                },
                {
                  "@type": "WebSite",
                  name: "모두의 모임",
                  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr",
                  inLanguage: "ko-KR",
                },
              ],
            }),
          }}
        />
      </head>
      <body className="h-full">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
