"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThumbsUp, ThumbsDown, PenLine } from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";

type Review = {
  id: string;
  author: string;
  content: string;
  created_at: string;
  up: number;
  down: number;
  myReaction: "up" | "down" | null;
  isMine: boolean;
};

const PAGE = 10;

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function ReviewsPage() {
  const router = useRouter();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [toast, setToast] = useState("");

  const load = useCallback(async (p: number) => {
    const res = await fetch(`/api/reviews?limit=${PAGE}&offset=${p * PAGE}`);
    if (!res.ok) {
      setReviews([]);
      return;
    }
    const data = (await res.json()) as { reviews: Review[]; total: number };
    setReviews(data.reviews);
    setTotal(data.total);
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 2400);
  };

  // 좋아요/싫어요 — 한 후기에 1회, 같은 걸 다시 누르면 취소
  const react = async (review: Review, kind: "up" | "down") => {
    const res = await fetch("/api/reviews/react", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewId: review.id, kind }),
    });
    if (res.status === 401) {
      router.push("/login?next=/reviews");
      return;
    }
    if (!res.ok) {
      flash("잠시 후 다시 시도해 주세요.");
      return;
    }
    const { myReaction } = (await res.json()) as { myReaction: "up" | "down" | null };
    setReviews((prev) =>
      (prev ?? []).map((r) => {
        if (r.id !== review.id) return r;
        // 이전 반응 되돌리고 새 반응 반영
        let { up, down } = r;
        if (r.myReaction === "up") up -= 1;
        if (r.myReaction === "down") down -= 1;
        if (myReaction === "up") up += 1;
        if (myReaction === "down") down += 1;
        return { ...r, up, down, myReaction };
      }),
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  return (
    <div className="app-main pb-10">
      <TopNav title="모두의 모임 후기" back />

      <div className="page-content pt-4 flex items-center justify-between">
        <div>
          <h2 className="tds-title-lg">모두의 모임 후기</h2>
          <p className="tds-caption mt-1">모임에 참여하신 분들이 직접 남긴 후기예요.</p>
        </div>
        <Link href="/reviews/write" className="rv-write-btn">
          <PenLine size={15} /> 후기 쓰기
        </Link>
      </div>

      <section className="page-content pt-5">
        {reviews === null ? (
          <p className="tds-caption py-10 text-center">불러오는 중…</p>
        ) : reviews.length === 0 ? (
          <div className="tds-card p-8 text-center">
            <p className="tds-subtitle">아직 등록된 후기가 없어요.</p>
            <Link href="/reviews/write" className="rv-empty-btn">
              첫 후기 남기기
            </Link>
          </div>
        ) : (
          <div className="rv-list">
            {reviews.map((r) => (
              <article key={r.id} className="rv-item">
                <div className="rv-head">
                  <span className="rv-author">{r.author}</span>
                  <span className="rv-date">{formatDate(r.created_at)}</span>
                </div>
                <p className="rv-text">{r.content}</p>
                <div className="rv-react">
                  <button
                    type="button"
                    className={`rv-btn ${r.myReaction === "up" ? "is-on" : ""}`}
                    onClick={() => react(r, "up")}
                  >
                    <ThumbsUp size={14} /> {r.up}
                  </button>
                  <button
                    type="button"
                    className={`rv-btn ${r.myReaction === "down" ? "is-down" : ""}`}
                    onClick={() => react(r, "down")}
                  >
                    <ThumbsDown size={14} /> {r.down}
                  </button>
                  {/* 좋아요 비율 (반응이 있을 때만) */}
                  {r.up + r.down > 0 && (
                    <span className="rv-rate">
                      좋아요 {Math.round((r.up / (r.up + r.down)) * 100)}%
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {/* 페이지네이션 */}
        {reviews !== null && total > PAGE && (
          <div className="rv-pager">
            <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              이전
            </button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              다음
            </button>
          </div>
        )}
      </section>

      {toast && <div className="rv-toast">{toast}</div>}

      <SiteFooter />
    </div>
  );
}
