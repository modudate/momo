"use client";

import { useCallback, useEffect, useState } from "react";
import { Send, RefreshCw } from "lucide-react";

type Inquiry = {
  id: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  user_name: string;
  user_phone: string;
  user_email: string;
};

// 1:1 문의 관리 — 목록 + 답변 작성
export default function InquiriesPanel({ flash }: { flash: (m: string) => void }) {
  const [items, setItems] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "answered">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/inquiries");
    if (res.ok) {
      const data = (await res.json()) as { inquiries: Inquiry[] };
      setItems(data.inquiries);
      setDrafts(Object.fromEntries(data.inquiries.map((q) => [q.id, q.answer ?? ""])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sendAnswer = async (id: string) => {
    const answer = (drafts[id] ?? "").trim();
    if (!answer) {
      flash("답변 내용을 입력해 주세요.");
      return;
    }
    setSaving(id);
    const res = await fetch("/api/admin/inquiries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, answer }),
    });
    setSaving(null);
    if (res.ok) {
      flash("답변을 등록했어요.");
      load();
    } else {
      flash("답변 등록에 실패했어요.");
    }
  };

  const shown = items.filter((q) => filter === "all" || q.status === filter);
  const openCount = items.filter((q) => q.status !== "answered").length;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">
          1:1 문의 ({items.length}){openCount > 0 && ` · 대기 ${openCount}`}
        </span>
        <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={load}>
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      <div className="inq-adm-tabs">
        {(["all", "open", "answered"] as const).map((f) => (
          <button
            key={f}
            type="button"
            className="inq-adm-tab"
            data-active={f === filter}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "전체" : f === "open" ? "답변대기" : "답변완료"}
          </button>
        ))}
      </div>

      <div className="admin-card-pad">
        {loading ? (
          <div className="admin-empty">불러오는 중…</div>
        ) : shown.length === 0 ? (
          <div className="admin-empty">문의가 없어요.</div>
        ) : (
          <div className="inq-adm-list">
            {shown.map((q) => {
              const open = openId === q.id;
              return (
                <div key={q.id} className="inq-adm-item">
                  <button
                    type="button"
                    className="inq-adm-row"
                    onClick={() => setOpenId(open ? null : q.id)}
                  >
                    <span
                      className={`inq-badge ${q.status === "answered" ? "inq-badge-answered" : "inq-badge-open"}`}
                    >
                      {q.status === "answered" ? "답변완료" : "대기"}
                    </span>
                    <span className="inq-adm-title">{q.title}</span>
                    <span className="inq-adm-meta">
                      {q.user_name || q.user_email || "회원"} ·{" "}
                      {new Date(q.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </button>

                  {open && (
                    <div className="inq-adm-body">
                      <div className="inq-adm-writer">
                        <b>{q.user_name || "-"}</b>
                        {q.user_phone && <span> · {q.user_phone}</span>}
                        {q.user_email && <span> · {q.user_email}</span>}
                      </div>
                      <p className="inq-adm-content">{q.content}</p>

                      <label className="inq-adm-answer-label">답변</label>
                      <textarea
                        className="inq-editor"
                        rows={5}
                        value={drafts[q.id] ?? ""}
                        placeholder="답변 내용을 입력하세요."
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [q.id]: e.target.value }))
                        }
                      />
                      <button
                        className="admin-btn admin-btn-primary admin-btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => sendAnswer(q.id)}
                        disabled={saving === q.id}
                      >
                        <Send size={14} />{" "}
                        {saving === q.id
                          ? "등록 중…"
                          : q.status === "answered"
                            ? "답변 수정"
                            : "답변 등록"}
                      </button>
                      {q.answered_at && (
                        <span className="inq-adm-answered-at">
                          {new Date(q.answered_at).toLocaleString("ko-KR")} 답변
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
