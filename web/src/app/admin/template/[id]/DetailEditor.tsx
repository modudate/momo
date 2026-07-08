"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, ImagePlus, Trash2, ArrowUp, ArrowDown, Save } from "lucide-react";

type Block = { type: "text"; text: string } | { type: "image"; url: string };

// 상품 상세 페이지 블록 에디터 — 텍스트/이미지 블록을 쌓아서 상세를 구성
export default function DetailEditor({
  templateId,
  flash,
}: {
  templateId: string;
  flash: (m: string) => void;
}) {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/templates/detail?id=${encodeURIComponent(templateId)}`);
    if (res.ok) setBlocks(((await res.json()) as { detail: Block[] }).detail);
    setLoading(false);
  }, [templateId]);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = (next: Block[]) => {
    setBlocks(next);
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/admin/templates/detail", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: templateId, detail: blocks }),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      flash("상세 페이지를 저장했어요.");
    } else {
      flash("저장에 실패했어요.");
    }
  };

  const addText = () => mutate([...blocks, { type: "text", text: "" }]);

  // 여러 장 한 번에 — 선택한 순서대로 차례로 업로드해 블록 추가
  const addImages = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const added: Block[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("folder", "detail");
        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
        if (res.ok) {
          const data = (await res.json()) as { url: string };
          added.push({ type: "image", url: data.url });
        } else {
          flash(`${file.name} 업로드에 실패했어요.`);
        }
      }
      if (added.length > 0) mutate([...blocks, ...added]);
    } finally {
      setUploading(false);
    }
  };

  const remove = (i: number) => mutate(blocks.filter((_, idx) => idx !== i));

  const move = (i: number, dir: -1 | 1) => {
    const to = i + dir;
    if (to < 0 || to >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[to]] = [next[to], next[i]];
    mutate(next);
  };

  const setText = (i: number, text: string) => {
    const next = [...blocks];
    next[i] = { type: "text", text };
    mutate(next);
  };

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">상세 페이지 편집</span>
        <div className="flex gap-1.5">
          <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={addText}>
            <Plus size={14} /> 텍스트
          </button>
          <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer" }}>
            <ImagePlus size={14} /> {uploading ? "업로드 중…" : "이미지 (여러 장 가능)"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              style={{ display: "none" }}
              disabled={uploading}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length > 0) addImages(files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            className="admin-btn admin-btn-primary admin-btn-sm"
            onClick={save}
            disabled={saving || !dirty}
          >
            <Save size={14} /> {saving ? "저장 중…" : dirty ? "저장" : "저장됨"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="admin-empty">불러오는 중…</div>
      ) : blocks.length === 0 ? (
        <div className="admin-empty">
          <b>텍스트</b> / <b>이미지</b> 버튼으로 블록을 추가해 상세 페이지를 만들어 보세요.
          <br />
          이미지는 여러 장을 한 번에(순서대로) 올릴 수 있고, 상세페이지에서 폭 100%로 노출됩니다.
        </div>
      ) : (
        <div className="detail-editor">
          {blocks.map((b, i) => (
            <div key={i} className="detail-block">
              <div className="detail-block-body">
                {b.type === "text" ? (
                  <textarea
                    className="admin-textarea"
                    value={b.text}
                    placeholder="내용을 입력하세요"
                    onChange={(e) => setText(i, e.target.value)}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={b.url} alt={`블록 ${i + 1}`} className="detail-block-img" />
                )}
              </div>
              <div className="detail-block-actions">
                <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => move(i, -1)} disabled={i === 0} title="위로">
                  <ArrowUp size={14} />
                </button>
                <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => move(i, 1)} disabled={i === blocks.length - 1} title="아래로">
                  <ArrowDown size={14} />
                </button>
                <button className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" onClick={() => remove(i)} title="삭제">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
