"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Save, RotateCcw, ExternalLink, Pencil } from "lucide-react";
import { DEFAULT_FAQ, type FaqItem } from "@/data/faq";

const NO_CATEGORY = ""; // 분류가 없는 옛 데이터

// 카테고리 목록 — 처음 등장한 순서 = 사이트의 탭 순서
function categoriesOf(items: FaqItem[]): string[] {
  return [...new Set(items.map((it) => (it.c ?? "").trim()))];
}

// 같은 카테고리끼리 붙여 정렬한다.
// 사이트 /faq 는 "카테고리가 같고 순서상 붙어 있는" 질문끼리 한 탭으로 묶으므로,
// 관리자에서 항상 이 형태를 유지해야 탭이 쪼개지지 않는다.
function normalize(items: FaqItem[]): FaqItem[] {
  const cats = categoriesOf(items);
  return cats.flatMap((c) => items.filter((it) => (it.c ?? "").trim() === c));
}

// 자주 묻는 질문 관리 — 카테고리 탭 / 추가·수정·순서·삭제 후 [저장]
export default function FaqPanel({ flash }: { flash: (m: string) => void }) {
  const [items, setItems] = useState<FaqItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>(NO_CATEGORY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/site-content?key=faq");
    let next = DEFAULT_FAQ;
    if (res.ok) {
      const data = (await res.json()) as { value: { items?: FaqItem[] } | null };
      const saved = data.value?.items;
      if (Array.isArray(saved) && saved.length > 0) next = saved;
    }
    const normalized = normalize(next);
    setItems(normalized);
    setActiveCat(categoriesOf(normalized)[0] ?? NO_CATEGORY);
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = (next: FaqItem[]) => {
    setItems(normalize(next));
    setDirty(true);
  };

  const categories = useMemo(() => categoriesOf(items), [items]);

  // 현재 탭의 질문들 — 전체 배열에서의 위치(idx)를 같이 들고 있어야 이동/삭제가 가능
  const visible = useMemo(
    () => items.map((it, idx) => ({ it, idx })).filter(({ it }) => (it.c ?? "").trim() === activeCat),
    [items, activeCat],
  );

  const save = async () => {
    const cleaned = normalize(items)
      .map((it) => {
        const c = (it.c ?? "").trim();
        return { ...(c ? { c } : {}), q: it.q.trim(), a: it.a.trim() };
      })
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

  // 새 질문은 현재 탭의 "맨 위"에 추가한다
  const add = () => {
    const first = visible[0]?.idx ?? items.length;
    const next = [...items];
    next.splice(first, 0, { q: "", a: "", c: activeCat });
    mutate(next);
  };

  const addCategory = () => {
    const name = window.prompt("새 카테고리 이름 (예: 🎁 기타)")?.trim();
    if (!name) return;
    if (categories.includes(name)) {
      setActiveCat(name);
      return;
    }
    mutate([...items, { q: "", a: "", c: name }]);
    setActiveCat(name);
  };

  const renameCategory = () => {
    const name = window.prompt("카테고리 이름 수정", activeCat)?.trim();
    if (!name || name === activeCat) return;
    mutate(items.map((it) => ((it.c ?? "").trim() === activeCat ? { ...it, c: name } : it)));
    setActiveCat(name);
  };

  const remove = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    mutate(next);
    // 이 탭의 마지막 질문을 지웠으면 남아있는 탭으로 옮겨간다
    if (!next.some((it) => (it.c ?? "").trim() === activeCat)) {
      setActiveCat(categoriesOf(next)[0] ?? NO_CATEGORY);
    }
  };

  // 같은 카테고리 안에서만 위/아래 이동 (탭을 넘나들지 않는다)
  const move = (pos: number, dir: -1 | 1) => {
    const to = pos + dir;
    if (to < 0 || to >= visible.length) return;
    const a = visible[pos].idx;
    const b = visible[to].idx;
    const next = [...items];
    [next[a], next[b]] = [next[b], next[a]];
    mutate(next);
  };

  const setField = (idx: number, field: keyof FaqItem, value: string) => {
    const next = [...items];
    next[idx] = { ...next[idx], [field]: value };
    // 카테고리를 바꾸면 그 탭으로 따라간다
    if (field === "c") setActiveCat(value);
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
        <span className="admin-card-title">
          자주 묻는 질문 ({items.length})
        </span>
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
                const d = normalize(DEFAULT_FAQ);
                setItems(d);
                setActiveCat(categoriesOf(d)[0] ?? NO_CATEGORY);
                setDirty(true);
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

      {/* 카테고리 탭 — 사이트 /faq 의 탭과 같은 구성 */}
      <div className="faq-adm-tabs">
        {categories.map((c) => {
          const count = items.filter((it) => (it.c ?? "").trim() === c).length;
          return (
            <button
              key={c || "(분류없음)"}
              type="button"
              className="faq-adm-tab"
              data-active={c === activeCat}
              onClick={() => setActiveCat(c)}
            >
              {c || "분류 없음"} <span className="faq-adm-tab-n">{count}</span>
            </button>
          );
        })}
        <button type="button" className="faq-adm-tab is-add" onClick={addCategory}>
          <Plus size={14} /> 카테고리
        </button>
      </div>

      <div className="admin-card-pad">
        <p className="tds-caption" style={{ marginBottom: 14 }}>
          사이트 <b>자주 묻는 질문</b> 페이지에 카테고리별 탭으로 나옵니다. 답변의 <b>줄바꿈</b>은 그대로
          반영돼요. <b>질문 추가</b>는 지금 보고 있는 탭의 맨 위에 생깁니다.
        </p>

        {visible.length === 0 ? (
          <div className="admin-empty">
            이 카테고리에 질문이 없어요. <b>질문 추가</b>로 만들어 보세요.
          </div>
        ) : (
          <div className="faq-admin-list">
            {visible.map(({ it, idx }, pos) => (
              <div className="faq-admin-item" key={idx}>
                <div className="faq-admin-no">Q{pos + 1}</div>
                <div className="faq-admin-body">
                  <input
                    className="admin-input"
                    value={it.q}
                    onChange={(e) => setField(idx, "q", e.target.value)}
                    placeholder="질문 (예: 혼자 가도 괜찮을까요?)"
                  />
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={it.a}
                    onChange={(e) => setField(idx, "a", e.target.value)}
                    placeholder="답변 (줄바꿈 가능)"
                  />
                  <label className="faq-admin-move">
                    카테고리
                    <select
                      className="admin-input"
                      value={(it.c ?? "").trim()}
                      onChange={(e) => setField(idx, "c", e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c || "(분류없음)"} value={c}>
                          {c || "분류 없음"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="faq-admin-tools">
                  <button
                    className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                    onClick={() => move(pos, -1)}
                    disabled={pos === 0}
                    title="위로"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                    onClick={() => move(pos, 1)}
                    disabled={pos === visible.length - 1}
                    title="아래로"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon"
                    onClick={() => remove(idx)}
                    title="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeCat && (
          <button
            className="admin-btn admin-btn-ghost admin-btn-sm"
            style={{ marginTop: 12 }}
            onClick={renameCategory}
          >
            <Pencil size={14} /> &lsquo;{activeCat}&rsquo; 카테고리 이름 수정
          </button>
        )}
      </div>
    </div>
  );
}
