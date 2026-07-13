"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";
import { uploadImage } from "@/lib/uploadImage";

type Hero = {
  badge: string;
  title: string;
  sub: string;
  images: string[];
};

const DEFAULT_HERO: Hero = {
  badge: "화·수·목·금·토·일 연중무휴",
  title: "늘 좋은 사람들만 모이는 모두의 모임",
  sub: "편하게 오세요, 어디서든",
  images: [],
};

export default function HomeBannerPanel({ flash }: { flash: (m: string) => void }) {
  const [hero, setHero] = useState<Hero>(DEFAULT_HERO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/site-content?key=hero");
    if (res.ok) {
      const data = (await res.json()) as { value: Hero | null };
      if (data.value) setHero({ ...DEFAULT_HERO, ...data.value });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (next?: Hero) => {
    const value = next ?? hero;
    setSaving(true);
    const res = await fetch("/api/admin/site-content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "hero", value }),
    });
    setSaving(false);
    if (res.ok) flash("홈 배너를 저장했어요.");
    else flash("저장에 실패했어요.");
  };

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImage(file, "hero");
      const next = { ...hero, images: [...hero.images, url] };
      setHero(next);
      await save(next); // 업로드 즉시 저장
    } catch {
      flash("업로드에 실패했어요.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (idx: number) => {
    const next = { ...hero, images: hero.images.filter((_, i) => i !== idx) };
    setHero(next);
    save(next);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const to = idx + dir;
    if (to < 0 || to >= hero.images.length) return;
    const images = [...hero.images];
    [images[idx], images[to]] = [images[to], images[idx]];
    const next = { ...hero, images };
    setHero(next);
    save(next);
  };

  if (loading) {
    return (
      <div className="admin-card">
        <div className="admin-empty">불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="banner-layout">
      {/* 문구 */}
      <div className="admin-card">
        <div className="admin-card-head">
          <span className="admin-card-title">배너 문구</span>
        </div>
        <div className="admin-card-pad flex flex-col gap-3" style={{ padding: 18 }}>
          <div className="admin-field">
            <label className="admin-label">배지 (주황 라벨)</label>
            <input
              className="admin-input"
              value={hero.badge}
              onChange={(e) => setHero({ ...hero, badge: e.target.value })}
              placeholder="화·수·목·금·토·일 연중무휴"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">타이틀</label>
            <input
              className="admin-input"
              value={hero.title}
              onChange={(e) => setHero({ ...hero, title: e.target.value })}
              placeholder="늘 좋은 사람들만 모이는 모두의 모임"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">서브 문구</label>
            <input
              className="admin-input"
              value={hero.sub}
              onChange={(e) => setHero({ ...hero, sub: e.target.value })}
              placeholder="편하게 오세요, 어디서든"
            />
          </div>
          <button className="admin-btn admin-btn-primary" onClick={() => save()} disabled={saving}>
            <Save size={16} /> {saving ? "저장 중…" : "문구 저장"}
          </button>
        </div>
      </div>

      {/* 이미지 */}
      <div className="admin-card">
        <div className="admin-card-head">
          <span className="admin-card-title">배너 이미지 ({hero.images.length})</span>
          <label className="admin-btn admin-btn-primary admin-btn-sm" style={{ cursor: "pointer" }}>
            <Upload size={15} /> {uploading ? "업로드 중…" : "이미지 추가"}
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
        </div>
        {hero.images.length === 0 ? (
          <div className="admin-empty">
            이미지가 없어요. <b>이미지 추가</b>로 업로드하면 홈 배너가 슬라이드로 돌아가요.
          </div>
        ) : (
          <div className="banner-grid">
            {hero.images.map((url, i) => (
              <div className="banner-item" key={`${url}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`배너 ${i + 1}`} />
                <span className="banner-order">{i + 1}</span>
                <div className="banner-actions">
                  <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => move(i, -1)} disabled={i === 0} title="앞으로">
                    <ArrowUp size={14} />
                  </button>
                  <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => move(i, 1)} disabled={i === hero.images.length - 1} title="뒤로">
                    <ArrowDown size={14} />
                  </button>
                  <button className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" onClick={() => removeImage(i)} title="삭제">
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
