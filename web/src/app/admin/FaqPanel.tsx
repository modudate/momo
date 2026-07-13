"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, ExternalLink } from "lucide-react";
import { DEFAULT_FAQ, type FaqItem } from "@/data/faq";

// 자주 묻는 질문 관리 — 추가·수정·순서·삭제 후 [저장]
export default function FaqPanel({ flash }: { flash: (m: string) => void }) {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/site-content?key=faq");
    if (res.ok) {
      const data = (await res.json()) as { value: { items?: FaqItem[] } | null };
      const saved = data.value?.items;
      setItems(Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_FAQ);
    } else {
      setItems(DEFAULT_FAQ);
    }
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = (next: FaqItem[]) => {
    setItems(next);
    setDirty(true);
  };

  const save = async () => {
    const cleaned = items
      .map((it) => ({ q: it.q.trim(), a: it.a.trim() }))
      .filter((it) => it.q); // 질문이 빈 항목은 제외
    if (cleaned.length === 0) {
      flash("질문을 하나 이상 입력해 주세요.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/site-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "faq", value: { items: cleaned } }),
    });
    setSaving(false);
    if (res.ok) {
      setItems(cleaned);
      setDirty(false);
      flash("자주 묻는 질문을 저장했어요. (사이트 반영 최대 1분)");
    } else {
      flash("저장에 실패했어요.");
    }
  };

  const add = () => mutate([...items, { q: "", a: "" }]);
  const remove = (i: number) => mutate(items.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    [next[i], next[to]] = [next[to], next[i]];
    mutate(next);
  };
  const setField = (i: number, field: keyof FaqItem, value: string) => {
    const next = [...items];
    next[i] = { ...next[i], [field]: value };
    mutate(next);
  };

  if (loading) {
    return (
      <div className="admin-card">
        <div className="admin-empty">불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">자주 묻는 질문 ({items.length})</span>
        <div className="flex gap-1.5">
          <a
            href="/faq"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost admin-btn-sm"
          >
            <ExternalLink size={14} /> 사이트에서 보기
          </a>
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            onClick={() => {
              if (window.confirm("기본 질문으로 되돌릴까요? (저장을 눌러야 실제로 반영돼요)")) {
                mutate(DEFAULT_FAQ);
              }
            }}
          >
            <RotateCcw size={14} /> 기본값
          </button>
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={add}>
            <Plus size={15} /> 질문 추가
          </button>
          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={save}
            disabled={saving || !dirty}
          >
            <Save size={15} /> {saving ? "저장 중…" : dirty ? "저장" : "저장됨"}
          </button>
        </div>
      </div>

      <div className="admin-card-pad">
        <p className="tds-caption" style={{ marginBottom: 14 }}>
          홈 하단의 <b>자주 묻는 질문</b> 페이지에 그대로 나와요. 답변에서 <b>줄바꿈</b>은 그대로 반영됩니다.
        </p>

        {items.length === 0 ? (
          <div className="admin-empty">
            질문이 없어요. <b>질문 추가</b>로 만들어 보세요.
          </div>
        ) : (
          <div className="faq-admin-list">
            {items.map((item, i) => (
              <div className="faq-admin-item" key={i}>
                <div className="faq-admin-no">Q{i + 1}</div>
                <div className="faq-admin-body">
                  <input
                    className="admin-input"
                    value={item.q}
                    onChange={(e) => setField(i, "q", e.target.value)}
                    placeholder="질문 (예: 혼자 가도 괜찮을까요?)"
                  />
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={item.a}
                    onChange={(e) => setField(i, "a", e.target.value)}
                    placeholder="답변 (줄바꿈 가능)"
                  />
                </div>
                <div className="faq-admin-tools">
                  <button
                    className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    title="위로"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                    onClick={() => move(i, 1)}
                    disabled={i === items.length - 1}
                    title="아래로"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon"
                    onClick={() => remove(i)}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
