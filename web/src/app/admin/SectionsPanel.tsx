"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

export type HomeSection = { key: string; title: string; card_label: string; sort: number };

// 홈 카테고리(노출 섹션) 관리 — 추가·이름수정·순서·삭제
export default function SectionsPanel({ flash }: { flash: (m: string) => void }) {
  const [sections, setSections] = useState<HomeSection[] | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", cardLabel: "", sort: 0 });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ key: "", title: "", cardLabel: "", sort: 10 });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/sections");
    if (res.ok) setSections((await res.json()).sections);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/sections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ key: "", title: "", cardLabel: "", sort: 10 });
      setCreating(false);
      flash("카테고리를 추가했어요.");
      load();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    flash(
      data.error === "key_exists"
        ? "이미 있는 영문 키예요."
        : data.error === "key_invalid"
          ? "영문 키는 영문 소문자·숫자·하이픈 2~24자로 입력해 주세요."
          : "추가에 실패했어요.",
    );
  };

  const startEdit = (s: HomeSection) => {
    setEditKey(s.key);
    setDraft({ title: s.title, cardLabel: s.card_label, sort: s.sort });
  };

  const saveEdit = async (key: string) => {
    const res = await fetch("/api/admin/sections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...draft }),
    });
    if (res.ok) {
      setEditKey(null);
      flash("수정했어요.");
      load();
    } else {
      flash("수정에 실패했어요.");
    }
  };

  const remove = async (s: HomeSection) => {
    if (!window.confirm(`"${s.title}" 카테고리를 삭제할까요?`)) return;
    const res = await fetch(`/api/admin/sections?key=${encodeURIComponent(s.key)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      flash("삭제했어요.");
      load();
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string; count?: number };
    flash(
      data.error === "in_use"
        ? `이 카테고리를 쓰는 상품이 ${data.count}개 있어요. 상품에서 먼저 해제해 주세요.`
        : "삭제에 실패했어요.",
    );
  };

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">홈 카테고리</span>
        <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={() => setCreating((v) => !v)}>
          <Plus size={15} /> 카테고리 추가
        </button>
      </div>

      <div className="admin-card-pad">
        <p className="tds-caption" style={{ marginBottom: 12 }}>
          홈 화면에 노출되는 모임 묶음이에요. 상품 등록·수정에서 이 카테고리를 선택하면 홈의 해당 섹션에 나타납니다.
          (카드가 하나도 없는 카테고리는 홈에서 자동으로 숨겨져요.)
        </p>

        {creating && (
          <form onSubmit={create} className="sec-form">
            <input
              className="admin-input"
              style={{ width: 130 }}
              placeholder="영문 키 (foreign)"
              value={form.key}
              onChange={(e) => setForm({ ...form, key: e.target.value })}
            />
            <input
              className="admin-input"
              style={{ flex: 1, minWidth: 220 }}
              placeholder="섹션 제목 (🔥 외국인과 함께하는 모임)"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <input
              className="admin-input"
              style={{ width: 120 }}
              placeholder="카드 라벨"
              value={form.cardLabel}
              onChange={(e) => setForm({ ...form, cardLabel: e.target.value })}
            />
            <input
              className="admin-input"
              style={{ width: 80 }}
              type="number"
              placeholder="순서"
              value={form.sort}
              onChange={(e) => setForm({ ...form, sort: Number(e.target.value) })}
            />
            <button type="submit" className="admin-btn admin-btn-primary">
              <Plus size={15} /> 추가
            </button>
          </form>
        )}

        {sections === null ? (
          <div className="admin-empty">불러오는 중…</div>
        ) : sections.length === 0 ? (
          <div className="admin-empty">카테고리가 없어요. [카테고리 추가]로 만들어 보세요.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 90 }}>순서</th>
                  <th>섹션 제목 (홈에 보이는 문구)</th>
                  <th style={{ width: 130 }}>카드 라벨</th>
                  <th style={{ width: 120 }}>영문 키</th>
                  <th style={{ width: 110 }}></th>
                </tr>
              </thead>
              <tbody>
                {sections.map((s) => {
                  const editing = editKey === s.key;
                  return (
                    <tr key={s.key}>
                      <td>
                        {editing ? (
                          <input
                            className="admin-input"
                            type="number"
                            style={{ width: 70 }}
                            value={draft.sort}
                            onChange={(e) => setDraft({ ...draft, sort: Number(e.target.value) })}
                          />
                        ) : (
                          s.sort
                        )}
                      </td>
                      <td className="font-semibold text-[var(--text-primary)]">
                        {editing ? (
                          <input
                            className="admin-input"
                            value={draft.title}
                            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                          />
                        ) : (
                          s.title
                        )}
                      </td>
                      <td>
                        {editing ? (
                          <input
                            className="admin-input"
                            value={draft.cardLabel}
                            onChange={(e) => setDraft({ ...draft, cardLabel: e.target.value })}
                          />
                        ) : (
                          s.card_label || "-"
                        )}
                      </td>
                      <td className="tds-caption">{s.key}</td>
                      <td>
                        <div className="flex gap-1.5 justify-end">
                          {editing ? (
                            <>
                              <button
                                className="admin-btn admin-btn-primary admin-btn-sm admin-btn-icon"
                                onClick={() => saveEdit(s.key)}
                                title="저장"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                                onClick={() => setEditKey(null)}
                                title="취소"
                              >
                                <X size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                                onClick={() => startEdit(s)}
                                title="수정"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon"
                                onClick={() => remove(s)}
                                title="삭제"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
