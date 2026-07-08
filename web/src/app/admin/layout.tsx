import type { Metadata } from "next";

// 관리자 영역 — 검색엔진 색인 제외
export const metadata: Metadata = {
  title: "관리자 — 모두의 모임",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
