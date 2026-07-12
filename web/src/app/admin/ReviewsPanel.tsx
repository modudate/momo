"use client";

import { useCallback, useEffect, useState } from "react";
import { Trash2, ThumbsUp, ThumbsDown } from "lucide-react";

type AdminReview = {
  id: string;
  content: string;
  created_at: string;
  name: string;
  phone: string;
  meeting: string;
  up: number;
  down: number;
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// 후기 관리 — 목록 + 삭제 (부적절·테러성 글 제거)
export default function ReviewsPanel({ flash }: { flash: (m: string) => void }) {
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reviews");
    if (res.ok) setReviews((await res.json()).reviews);
    else setReviews([]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (r: AdminReview) => {
    if (!window.confirm("이 후기를 삭제할까요? 되돌릴 수 없어요.")) return;
    const res = await fetch(`/api/admin/reviews?id=${r.id}`, { method: "DELETE" });
    if (res.ok) {
      flash("후기를 삭제했어요.");
      load();
    } else {
      flash("삭제에 실패했어요.");
    }
  };

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">
          후기 {reviews ? `(${reviews.length}건)` : ""}
        </span>
      </div>

      {reviews === null ? (
        <div className="admin-empty">불러오는 중…</div>
      ) : reviews.length === 0 ? (
        <div className="admin-empty">아직 등록된 후기가 없어요.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 100 }}>작성일</th>
                <th style={{ width: 100 }}>작성자</th>
                <th style={{ width: 120 }}>전화</th>
                <th style={{ width: 190 }}>모임</th>
                <th>내용</th>
                <th style={{ width: 110 }}>반응</th>
                <th style={{ width: 60 }}></th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td className="tds-caption">{formatDate(r.created_at)}</td>
                  <td className="font-semibold text-[var(--text-primary)]">{r.name}</td>
                  <td>{r.phone || "-"}</td>
                  <td className="tds-caption">{r.meeting}</td>
                  <td>
                    <span className="rv-admin-text">{r.content}</span>
                  </td>
                  <td>
                    <span className="rv-admin-react">
                      <ThumbsUp size={13} /> {r.up}
                      <ThumbsDown size={13} /> {r.down}
                    </span>
                  </td>
                  <td>
                    <button
                      className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon"
                      onClick={() => remove(r)}
                      title="삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
