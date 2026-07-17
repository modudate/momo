"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ImageIcon, ChevronRight } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import { DEFAULT_REVIEW_SLIDES, type ReviewSlide } from "@/data/faq";

// 상단 메뉴
const menu = [
  { label: "강남신청", href: "/region/gangnam" },
  { label: "홍대신청", href: "/region/hongdae" },
  { label: "수원신청", href: "/region/suwon" },
  { label: "인증", href: "/verify" },
  { label: "문의", href: "/contact" },
];

// 홈 모임 카드 — 관리자 예약 상품의 "홈 노출" 카테고리에서 로드
type HomeCard = {
  id: string;
  label: string;
  title: string;
  badge: string;
  tags: string[];
  image: string | null;
  href: string;
};

// 홈 섹션(카테고리) — 관리자에서 추가·수정
type HomeSection = { key: string; title: string; cards: HomeCard[] };

// 상품이 아직 지정되지 않았을 때의 기본 화면
const fallbackSections: HomeSection[] = [
  {
    key: "signature",
    title: "🔥 모두의 모임을 대표하는 시그니처 모임",
    cards: [
      { id: "s1", label: "시그니처", title: "모두의 와인", badge: "자연스러운 대화의 장", tags: ["2030", "3045"], image: null, href: "/region/gangnam" },
      { id: "s2", label: "시그니처", title: "모두의 커피", badge: "1:1 더욱 깊은 대화", tags: ["2030", "3045"], image: null, href: "/region/gangnam" },
    ],
  },
  {
    key: "premium",
    title: "🔥 특별한 분들을 위한 프리미엄 모임",
    cards: [
      { id: "p1", label: "프리미엄", title: "모두의 와인", badge: "압도적인 매력 검증", tags: ["2040"], image: null, href: "/verify" },
      { id: "p2", label: "인기남녀", title: "모두의 커피", badge: "누가봐도 호감형", tags: ["2030"], image: null, href: "/verify" },
    ],
  },
];

// 사진 자리 (나중에 이미지로 교체)
function Ph({ className = "" }: { className?: string }) {
  return (
    <div className={`home-ph ${className}`}>
      <ImageIcon size={22} />
    </div>
  );
}

type Hero = { badge: string; title: string; sub: string; images: string[] };

const DEFAULT_HERO: Hero = {
  badge: "화·수·목·금·토·일 연중무휴",
  title: "늘 좋은 사람들만 모이는 모두의 모임",
  sub: "편하게 오세요, 어디서든",
  images: [],
};

export default function HomePage() {
  const [sections, setSections] = useState<HomeSection[]>(fallbackSections);
  const [hero, setHero] = useState<Hero>(DEFAULT_HERO);
  const [slide, setSlide] = useState(0);
  const [slides, setSlides] = useState<ReviewSlide[]>(DEFAULT_REVIEW_SLIDES);
  const [rvIdx, setRvIdx] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/home/content")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            hero: Hero | null;
            sections: HomeSection[];
            reviewSlides?: ReviewSlide[];
          } | null,
        ) => {
          if (!active || !data) return;
          if (data.hero) setHero({ ...DEFAULT_HERO, ...data.hero });
          if (data.sections?.length > 0) setSections(data.sections);
          if (data.reviewSlides?.length) setSlides(data.reviewSlides);
        },
      )
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  // 히어로 자동 슬라이드 (4초)
  useEffect(() => {
    if (hero.images.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % hero.images.length), 4000);
    return () => clearInterval(t);
  }, [hero.images.length]);

  // 후기 자동 슬라이드 (5초)
  useEffect(() => {
    if (slides.length < 2) return;
    setRvIdx((i) => (i < slides.length ? i : 0));
    const t = setInterval(() => setRvIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, [slides.length]);

  return (
    <div className="app-main home">
      {/* 헤더 (로고) */}
      <header className="home-head">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_black.png" alt="모두의 모임" className="home-logo" />
      </header>

      {/* 메뉴 */}
      <nav className="home-menu">
        {menu.map((m) => (
          <Link key={m.label} href={m.href} className="home-menu-btn">
            {m.label}
          </Link>
        ))}
      </nav>

      {/* 히어로 슬라이더 (양옆 여백 없음 · 관리자 홈 배너에서 관리) */}
      <section className="home-hero">
        {hero.images.length > 0 ? (
          hero.images.map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${url}-${i}`}
              src={url}
              alt=""
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
              className={`home-hero-img ${i === slide % hero.images.length ? "is-on" : ""}`}
            />
          ))
        ) : (
          <Ph className="home-hero-ph" />
        )}
        {hero.images.length > 0 && (
          <span className="home-hero-count">
            {(slide % hero.images.length) + 1} / {hero.images.length}
          </span>
        )}
        <div className="home-hero-overlay">
          {hero.badge && <span className="home-hero-badge">{hero.badge}</span>}
          <h2 className="home-hero-title">{hero.title}</h2>
          {hero.sub && <p className="home-hero-sub">{hero.sub}</p>}
        </div>
      </section>

      {/* 모임 섹션 — 관리자 카테고리 기준 (시그니처 / 프리미엄 / 추가 카테고리…) */}
      {sections.map((s) => (
        <Section key={s.key} title={s.title}>
          <div className="home-grid">
            {s.cards.map((c) => (
              <MeetCard key={c.id} {...c} />
            ))}
          </div>
        </Section>
      ))}

      {/* 후기 — 관리자가 넣은 사진·문구 슬라이드 */}
      <Section title="👀 모두의 모임 후기" more="/reviews">
        <article className="home-review">
          <div className="home-review-stage">
            {slides.map((s, i) => (
              <div
                key={i}
                className={`home-review-slide ${i === rvIdx ? "is-on" : ""}`}
                aria-hidden={i !== rvIdx}
              >
                {s.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.image}
                    alt=""
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="home-review-ph home-review-img"
                  />
                ) : (
                  <Ph className="home-review-ph" />
                )}
                <div className="home-review-body">
                  {s.label && <span className="home-card-label">{s.label}</span>}
                  {s.title && <p className="home-review-title">{s.title}</p>}
                  {s.text && <p className="home-review-text">{s.text}</p>}
                </div>
              </div>
            ))}
          </div>

          {slides.length > 1 && (
            <div className="home-dots">
              {slides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`${i + 1}번 후기`}
                  className={i === rvIdx ? "on" : ""}
                  onClick={() => setRvIdx(i)}
                />
              ))}
            </div>
          )}
        </article>
      </Section>

      {/* CTA — 자주 묻는 질문 (배경 이미지) */}
      <section className="home-cta home-cta-orange" style={{ backgroundImage: "url('/cta-faq.webp')" }}>
        <p className="home-cta-title">
          모두의 모임
          <br />
          자주 묻는 질문
        </p>
        <Link href="/faq" className="home-cta-btn">
          자세히보기
        </Link>
      </section>

      <SiteFooter />
    </div>
  );
}

function Section({
  title,
  more,
  children,
}: {
  title: string;
  more?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="home-sec">
      <div className="home-sec-head">
        <h2 className="home-sec-title">{title}</h2>
        {more && (
          <Link href={more} className="home-more">
            더보기 <ChevronRight size={15} />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function MeetCard({ label, title, badge, tags, image, href }: HomeCard) {
  return (
    <Link href={href} className="home-meet">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={title} loading="lazy" decoding="async" className="home-meet-ph home-meet-img" />
      ) : (
        <Ph className="home-meet-ph" />
      )}
      <span className="home-card-label">{label}</span>
      <p className="home-meet-title">{title}</p>
      <div className="home-badges">
        {/* 검정 배지 — 한 줄 */}
        {badge && (
          <div className="home-badge-row">
            <span className="home-badge-dark">{badge}</span>
          </div>
        )}
        {/* 회색 태그 — 그 아래 줄 */}
        {tags.length > 0 && (
          <div className="home-tag-row">
            {tags.map((t) => (
              <span key={t} className="home-tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
