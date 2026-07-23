"use client";

import { Crown, Heart } from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { verifyPlans, type VerifyPlan } from "@/data/moim-data";

const icons: Record<VerifyPlan["slug"], React.ReactNode> = {
  premium: <Crown size={22} strokeWidth={2.2} />,
  popular: <Heart size={22} strokeWidth={2.2} />,
};

export default function VerifyPage() {
  return (
    <div className="app-main pb-10">
      <TopNav title="인증" back />

      <div className="page-content pt-5">
        <h2 className="tds-title-lg">어떤 인증을 진행하시나요?</h2>
        <p className="tds-subtitle mt-1.5">
          인증 후 전용 모임에 참여할 수 있어요. 참가비는 계좌이체로 안내됩니다.
        </p>
      </div>

      <section className="page-content pt-5 flex flex-col gap-4">
        {verifyPlans.map((p) => (
          <article key={p.slug} className="tds-card overflow-hidden">
            {/* 누르면 스모어 신청폼을 새 창으로 바로 연다 */}
            <a
              href={p.smoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-left p-5 active:bg-[var(--bg-surface)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)]"
                  style={{ background: "var(--accent-primary-light)", color: "var(--accent-primary)" }}
                >
                  {icons[p.slug]}
                </span>
                <div className="flex-1">
                  <span className="tds-badge tds-badge-accent">{p.badge}</span>
                  <p className="text-[17px] font-bold mt-1">{p.title}</p>
                </div>
              </div>
              <p className="tds-subtitle mt-3">{p.subtitle}</p>
              <div className="mt-4 h-12 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white font-bold text-[15px]">
                인증 신청하기
              </div>
            </a>
          </article>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
