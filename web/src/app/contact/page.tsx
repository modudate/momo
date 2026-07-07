"use client";

import { Phone, Instagram, MessageCircle, ChevronRight } from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { SITE } from "@/data/moim-data";

export default function ContactPage() {
  const channels = [
    {
      key: "phone",
      icon: <Phone size={20} />,
      bg: "#E8F3FF",
      color: "#3182F6",
      label: "전화 문의",
      desc: "바로 통화 연결",
      href: `tel:${SITE.phone.replace(/-/g, "")}`,
    },
    {
      key: "insta",
      icon: <Instagram size={20} />,
      bg: "#FCE7F0",
      color: "#E1306C",
      label: "인스타 문의",
      desc: "인스타그램 DM",
      href: SITE.instagram,
      external: true,
    },
    {
      key: "kakao",
      icon: <MessageCircle size={20} />,
      bg: "#FEF6C3",
      color: "#3C1E1E",
      label: "카카오톡 문의",
      desc: "카톡 채널 채팅",
      href: SITE.kakaoChannel,
      external: true,
    },
  ];

  return (
    <div className="app-main pb-10">
      <TopNav title="문의" back />

      <div className="page-content pt-5">
        <h2 className="tds-title-lg">편한 방법으로 문의하세요</h2>
        <p className="tds-subtitle mt-1.5">원하시는 채널을 선택하면 바로 연결돼요.</p>
      </div>

      <section className="page-content pt-5 flex flex-col gap-3">
        {channels.map((c) => (
          <a
            key={c.key}
            href={c.href}
            {...(c.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="tds-card flex items-center gap-3.5 p-4 active:scale-[0.99] transition-transform"
          >
            <span
              className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)] shrink-0"
              style={{ background: c.bg, color: c.color }}
            >
              {c.icon}
            </span>
            <div className="flex-1">
              <p className="text-[16px] font-bold">{c.label}</p>
              <p className="tds-caption mt-0.5">{c.desc}</p>
            </div>
            <ChevronRight size={20} className="text-[var(--text-muted)]" />
          </a>
        ))}
      </section>

      <SiteFooter />
    </div>
  );
}
