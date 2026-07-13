"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, ArrowLeft, ArrowRight, Save, Upload, ImageIcon } from "lucide-react";
import { uploadImage } from "@/lib/uploadImage";
import { DEFAULT_REVIEW_SLIDES, type ReviewSlide } from "@/data/faq";

const EMPTY: ReviewSlide = { image: "", label: "", title: "", text: "" };

// 홈 화면 후기 슬라이드 관리 — 사진 + 문구, 여러 장 슬라이드
export default function HomeReviewsPanel({ flash }: { flash: (m: string) => void }) {
  const [slides, setSlides] = useState<ReviewSlide[]>([]);
  const [cur, setCur] = useState(0); // 편집 중인 슬라이드
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/site-content?key=home-reviews");
    if (res.ok) {
      const data = (await res.json()) as { value: { slides?: ReviewSlide[] } | null };
      const saved = data.value?.slides;
      setSlides(Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_REVIEW_SLIDES);
    } else {
      setSlides(DEFAULT_REVIEW_SLIDES);
    }
    setCur(0);
    setDirty(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = (next: ReviewSlide[]) => {
    setSlides(next);
    setDirty(true);
  };

  const save = async () => {
    const cleaned = slides.filter((s) => s.title.trim() || s.text.trim() || s.image);
    if (cleaned.length === 0) {
      flash("슬라이드를 하나 이상 채워주세요.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/admin/site-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "home-reviews", value: { slides: cleaned } }),
    });
    setSaving(false);
    if (res.ok) {
      setSlides(cleaned);
      setCur((c) => Math.min(c, cleaned.length - 1));
      setDirty(false);
      flash("홈 후기를 저장했어요. (사이트 반영 최대 1분)");
    } else {
      flash("저장에 실패했어요.");
    }
  };

  const setField = (field: keyof ReviewSlide, value: string) => {
    const next = [...slides];
    next[cur] = { ...next[cur], [field]: value };
    mutate(next);
  };

  const addSlide = () => {
    const next = [...slides, { ...EMPTY }];
    mutate(next);
    setCur(next.length - 1);
  };

  const removeSlide = () => {
    if (slides.length <= 1) {
      flash("슬라이드는 최소 1개는 있어야 해요.");
      return;
    }
    if (!window.confirm(`${cur + 1}번 슬라이드를 삭제할까요?`)) return;
    const next = slides.filter((_, i) => i !== cur);
    mutate(next);
    setCur((c) => Math.max(0, Math.min(c, next.length - 1)));
  };

  // 슬라이드 순서 이동
  const moveSlide = (dir: -1 | 1) => {
    const to = cur + dir;
    if (to < 0 || to >= slides.length) return;
    const next = [...slides];
    [next[cur], next[to]] = [next[to], next[cur]];
    mutate(next);
    setCur(to);
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, "review");
      const next = [...slides];
      next[cur] = { ...next[cur], image: url };
      mutate(next);
    } catch {
      flash("업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-card">
        <div className="admin-empty">불러오는 중…</div>
      </div>
    );
  }

  const slide = slides[cur] ?? EMPTY;

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">홈 후기 슬라이드 ({slides.length})</span>
        <div className="flex gap-1.5">
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addSlide}>
            <Plus size={15} /> 슬라이드 추가
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
          홈 화면 <b>👀 모두의 모임 후기</b> 자리에 나오는 슬라이드예요. 사진과 문구를 직접 넣을 수 있고,
          여러 장을 넣으면 자동으로 넘어갑니다. (회원이 직접 쓴 후기는 아래 <b>회원 후기</b> 목록에서 관리)
        </p>

        {/* 슬라이드 탭 */}
        <div className="rvs-tabs">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              className={`rvs-tab ${i === cur ? "is-on" : ""}`}
              onClick={() => setCur(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <div className="rvs-editor">
          {/* 미리보기 + 사진 */}
          <div className="rvs-left">
            <div className="rvs-preview">
              {slide.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.image} alt="" />
              ) : (
                <div className="rvs-noimg">
                  <ImageIcon size={22} />
                  사진 없음
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer", flex: 1 }}>
                <Upload size={14} /> {uploading ? "업로드 중…" : "사진 바꾸기"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }}
                />
              </label>
              {slide.image && (
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                  onClick={() => setField("image", "")}
                  title="사진 제거"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 문구 */}
          <div className="rvs-right">
            <div className="admin-field">
              <label className="admin-label">라벨 (주황 글씨)</label>
              <input
                className="admin-input"
                value={slide.label}
                onChange={(e) => setField("label", e.target.value)}
                placeholder="예: 소문난 와인모임 맛집!"
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">제목</label>
              <input
                className="admin-input"
                value={slide.title}
                onChange={(e) => setField("title", e.target.value)}
                placeholder="예: 파트너님의 최고의 큐레이션"
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">본문</label>
              <textarea
                className="admin-textarea"
                rows={4}
                value={slide.text}
                onChange={(e) => setField("text", e.target.value)}
                placeholder="후기 내용을 적어주세요."
              />
            </div>

            <div className="flex gap-1.5">
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => moveSlide(-1)}
                disabled={cur === 0}
              >
                <ArrowLeft size={14} /> 앞으로
              </button>
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm"
                onClick={() => moveSlide(1)}
                disabled={cur === slides.length - 1}
              >
                <ArrowRight size={14} /> 뒤로
              </button>
              <button
                className="admin-btn admin-btn-danger admin-btn-sm"
                onClick={removeSlide}
                style={{ marginLeft: "auto" }}
              >
                <Trash2 size={14} /> 이 슬라이드 삭제
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
