import Link from "next/link";
import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { getAdminClient } from "@/lib/supabase/admin";
import type { DetailBlock } from "@/lib/data";

// 홈 노출 모임 전용 상세페이지 — 헤더 + 에디터 본문(이미지 100%) + 지점 신청 버튼 3개
export default async function MoimDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = getAdminClient();
  if (!admin) return notFound();

  const { data: template } = await admin
    .from("moim_templates")
    .select("id,title,home_section,detail")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      title: string;
      home_section: string | null;
      detail: DetailBlock[];
    }>();

  // 홈에 노출된 모임만 전용 상세페이지 제공
  if (!template || !template.home_section) return notFound();

  const blocks = Array.isArray(template.detail) ? template.detail : [];

  return (
    <div className="app-main">
      <TopNav title={template.title} back />

      {/* 본문 — 에디터 블록 (이미지 폭 100%) */}
      <div className="moim-view">
        {blocks.length === 0 ? (
          <p className="tds-caption py-16 text-center">상세 내용이 곧 등록됩니다.</p>
        ) : (
          blocks.map((block, i) =>
            block.type === "text" ? (
              <p key={i} className="moim-view-text">
                {block.text}
              </p>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={block.url}
                alt=""
                loading={i < 2 ? "eager" : "lazy"}
                decoding="async"
                className="moim-view-img"
              />
            ),
          )
        )}
      </div>

      {/* 지점 신청 버튼 3개 — 중앙 정렬 */}
      <div className="moim-apply">
        <Link href="/region/gangnam" className="moim-apply-btn">
          강남 신청
        </Link>
        <Link href="/region/hongdae" className="moim-apply-btn">
          홍대 신청
        </Link>
        <Link href="/region/suwon" className="moim-apply-btn">
          수원 신청
        </Link>
      </div>

      <SiteFooter />
    </div>
  );
}
