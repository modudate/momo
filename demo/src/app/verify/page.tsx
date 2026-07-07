"use client";

import { useState } from "react";
import { Check, Crown, Heart, Landmark, ExternalLink } from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { verifyPlans, formatKRW, type VerifyPlan } from "@/data/moim-data";

const icons: Record<VerifyPlan["slug"], React.ReactNode> = {
  premium: <Crown size={22} strokeWidth={2.2} />,
  popular: <Heart size={22} strokeWidth={2.2} />,
};

export default function VerifyPage() {
  const [open, setOpen] = useState<VerifyPlan | null>(null);

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
            <button
              type="button"
              className="w-full text-left p-5 active:bg-[var(--bg-surface)] transition-colors"
              onClick={() => setOpen(p)}
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
              <div className="flex items-center justify-between mt-4">
                <span className="tds-caption">참가비 (계좌이체)</span>
                <span className="text-[18px] font-extrabold">{formatKRW(p.fee)}</span>
              </div>
              <div className="mt-4 h-12 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white font-bold text-[15px]">
                인증 신청하기
              </div>
            </button>
          </article>
        ))}
      </section>

      {/* 상세 시트 — 랜딩 내용 + 스모어 계좌이체 */}
      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(ev) => ev.stopPropagation()}>
            <div className="sheet-handle" />
            <span className="tds-badge tds-badge-accent">{open.badge}</span>
            <p className="tds-title-md mt-2">{open.title}</p>
            <p className="tds-subtitle mt-1">{open.subtitle}</p>

            <ul className="mt-4 flex flex-col gap-2.5">
              {open.perks.map((perk) => (
                <li key={perk} className="flex items-start gap-2.5">
                  <Check size={18} className="text-[var(--accent-primary)] mt-0.5 shrink-0" />
                  <span className="tds-subtitle">{perk}</span>
                </li>
              ))}
            </ul>

            <div className="mt-5 mb-4 p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)]">
              <div className="flex justify-between items-center">
                <span className="tds-subtitle">참가비</span>
                <span className="text-[18px] font-extrabold">{formatKRW(open.fee)}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 tds-caption">
                <Landmark size={14} /> 스모어 신청 후 계좌이체로 결제
              </div>
            </div>

            {/* 스모어 신청폼 (계좌이체) */}
            <a href={open.smoreUrl} target="_blank" rel="noopener noreferrer" className="tds-btn-primary">
              <Landmark size={18} /> 스모어로 인증 신청 (계좌이체)
            </a>
            {/* 제작한 랜딩페이지 */}
            <a
              href={open.landingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tds-btn-ghost mt-2.5"
            >
              <ExternalLink size={16} /> 자세한 안내 보기
            </a>
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  );
}
