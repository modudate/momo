import Link from "next/link";
import { notFound } from "next/navigation";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { getAdminClient } from "@/lib/supabase/admin";
import type { DetailBlock } from "@/lib/data";
import { getVerifyPlan } from "@/data/moim-data";

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
    .select("id,title,home_section,category,detail")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      title: string;
      home_section: string | null;
      category: string | null;
      detail: DetailBlock[];
    }>();

  // 홈에 노출된 모임만 전용 상세페이지 제공
  if (!template || !template.home_section) return notFound();

  const blocks = Array.isArray(template.detail) ? template.detail : [];

  // 인증형 상품(프리미엄 / 인기남녀)은 지점 신청 대신 "인증 신청" 스모어 링크로 보낸다.
  //  category 값(premium / popular)이 곧 인증 플랜 slug 라 그대로 매핑된다.
  const verifyPlan = template.category ? getVerifyPlan(template.category) : undefined;

  return (
    <div className="app-main">
      <TopNav title={template.title} back />

      {/* 본문 — 에디터 블록 (이미지 폭 100%) */}
      <div className="moim-view">
        {blocks.length === 0 ? (
          <p className="tds-caption py-16 text-center">상세 내용이 곧 등록됩니다.</p>
        ) : (
          blocks.map((block, i) =>
            block.type === "html" ? (
              // 게시판식 에디터 저장분 — 관리자 작성 + 저장 시 정리(sanitize)됨
              <div key={i} className="rich-view" dangerouslySetInnerHTML={{ __html: block.html }} />
            ) : block.type === "text" ? (
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

      {verifyPlan ? (
        /* 인증형 상품 — 인증 신청(스모어) 새 창으로 */
        <div className="moim-apply moim-apply-verify">
          <a
            href={verifyPlan.smoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="moim-apply-btn moim-apply-btn-verify"
          >
            인증 신청하기
          </a>
        </div>
      ) : (
        /* 일반 모임 — 지점 신청 버튼 3개 (중앙 정렬) */
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
      )}

      <SiteFooter />
    </div>
  );
}
