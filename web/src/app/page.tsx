"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SITE } from "@/data/moim-data";

type Picked = "top" | "bottom" | null;

export default function LandingPage() {
  const router = useRouter();
  const [picked, setPicked] = useState<Picked>(null);

  useEffect(() => {
    router.prefetch("/home");
  }, [router]);

  const choose = (which: "top" | "bottom") => {
    if (picked) return;
    setPicked(which);
    // 카드 뒤집기 애니메이션이 끝난 뒤 이동
    window.setTimeout(() => {
      if (which === "top") router.push("/home");
      else window.location.href = SITE.datingUrl;
    }, 820);
  };

  return (
    <main className="landing">
      {/* 위쪽 50vh — 모두의 모임 (내부 사이트로 이동) */}
      <button
        type="button"
        className="landing-half landing-top"
        aria-label="모두의 모임"
        onClick={() => choose("top")}
      >
        <div className="landing-overlay landing-overlay-top" />
        <div className="landing-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_white.png" alt="모두의 모임" className="landing-logo" />
          <p className="landing-sub">강남 · 홍대 · 수원에서 열리는 오프라인 모임</p>
          <span className="landing-cta">
            모임 보러가기 <ArrowRight size={18} strokeWidth={2.4} />
          </span>
        </div>
      </button>

      {/* 아래쪽 50vh — 모두의 소개팅 (외부 사이트로 이동) */}
      <button
        type="button"
        className="landing-half landing-bottom"
        aria-label="모두의 소개팅"
        onClick={() => choose("bottom")}
      >
        <div className="landing-overlay landing-overlay-bottom" />
        <div className="landing-inner">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/moso_logo.png" alt="모두의 소개팅" className="landing-logo landing-logo-moso" />
          <p className="landing-sub landing-sub-light">진지한 만남을 원한다면, 이쪽으로</p>
          <span className="landing-cta landing-cta-light">
            소개팅 바로가기 <ArrowRight size={18} strokeWidth={2.4} />
          </span>
        </div>
      </button>

      {/* 선택 시: 확대되며 180도 카드 뒤집기 → 뒷면(흰 화면)에서 이동 (위=홈 / 아래=소개팅) */}
      {picked && (
        <div className="flip-stage" aria-hidden>
          <div className="flip-card">
            <div
              className={`flip-face flip-face-front ${
                picked === "bottom" ? "flip-face-front-bottom" : ""
              }`}
            >
              <div className="landing-inner">
                {picked === "top" ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_white.png" alt="모두의 모임" className="landing-logo" />
                  </>
                ) : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/moso_logo.png" alt="모두의 소개팅" className="landing-logo landing-logo-moso" />
                  </>
                )}
              </div>
            </div>
            <div className="flip-face flip-face-back" />
          </div>
        </div>
      )}
    </main>
  );
}
