import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://joinmomo.co.kr"),
  title: "모두의 모임",
  description: "강남·홍대·수원에서 열리는 오프라인 모임, 모두의 모임",
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
  // 카톡/SNS 공유 미리보기
  openGraph: {
    title: "모두의 모임",
    description: "강남·홍대·수원에서 열리는 오프라인 모임, 모두의 모임",
    siteName: "모두의 모임",
    type: "website",
    locale: "ko_KR",
    images: [{ url: "/og_image.png", width: 1200, height: 630, alt: "모두의 모임" }],
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
      </head>
      <body className="h-full">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
