"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Underline,
  Heading2,
  Pilcrow,
  AlignLeft,
  AlignCenter,
  Minus,
  ImagePlus,
  Save,
} from "lucide-react";
import { uploadImage } from "@/lib/uploadImage";

type Block =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "html"; html: string };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// 구 블록(텍스트/이미지) → HTML 문서로 변환 (게시판식 에디터로 이어서 편집)
function legacyToHtml(blocks: Block[]): string {
  return blocks
    .map((b) => {
      if (b.type === "html") return b.html;
      if (b.type === "image") return `<p><img src="${b.url}"></p>`;
      return b.text
        .split("\n")
        .map((line) => (line.trim() ? `<p>${esc(line)}</p>` : "<p><br></p>"))
        .join("");
    })
    .join("");
}

// 게시판 글쓰기식 WYSIWYG 에디터 — 본문에 글·이미지를 섞어서 작성, HTML로 저장
export default function DetailEditor({
  templateId,
  flash,
}: {
  templateId: string;
  flash: (m: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/templates/detail?id=${encodeURIComponent(templateId)}`);
    if (res.ok) {
      const blocks = ((await res.json()) as { detail: Block[] }).detail;
      if (editorRef.current) editorRef.current.innerHTML = legacyToHtml(blocks);
    }
    setLoading(false);
  }, [templateId]);

  useEffect(() => {
    // span style 방식으로 서식 적용 (font 태그 대신)
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* 미지원 브라우저 무시 */
    }
    load();
  }, [load]);

  const exec = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    setDirty(true);
  };

  const save = async () => {
    const el = editorRef.current;
    if (!el) return;
    const hasContent = (el.textContent ?? "").trim().length > 0 || el.querySelector("img,hr");
    const detail: Block[] = hasContent ? [{ type: "html", html: el.innerHTML }] : [];
    setSaving(true);
    const res = await fetch("/api/admin/templates/detail", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: templateId, detail }),
    });
    setSaving(false);
    if (res.ok) {
      setDirty(false);
      flash("상세 페이지를 저장했어요.");
    } else {
      flash("저장에 실패했어요.");
    }
  };

  // 여러 장 한 번에 — 업로드 후 커서 위치에 순서대로 삽입
  //  (브라우저에서 압축 후 버킷으로 직접 업로드하므로 용량 제한 없음)
  const addImages = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        try {
          urls.push(await uploadImage(file, "detail"));
        } catch {
          flash(`${file.name} 업로드에 실패했어요.`);
        }
      }
      if (urls.length > 0) {
        const html = urls.map((u) => `<p><img src="${u}"></p>`).join("");
        editorRef.current?.focus();
        if (!document.execCommand("insertHTML", false, html) && editorRef.current) {
          editorRef.current.innerHTML += html; // 삽입 실패 시 맨 뒤에 추가
        }
        setDirty(true);
      }
    } finally {
      setUploading(false);
    }
  };

  // 붙여넣기는 서식 없이 텍스트만 (외부 서식 오염 방지)
  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    if (text) document.execCommand("insertText", false, text);
  };

  const tb = (title: string, onClick: () => void, child: React.ReactNode) => (
    <button
      type="button"
      className="wys-btn"
      title={title}
      onMouseDown={(e) => e.preventDefault()} /* 에디터 선택 영역 유지 */
      onClick={onClick}
    >
      {child}
    </button>
  );

  return (
    <div className="admin-card">
      <div className="admin-card-head">
        <span className="admin-card-title">상세 페이지 편집</span>
        <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={save} disabled={saving || !dirty}>
          <Save size={14} /> {saving ? "저장 중…" : dirty ? "저장" : "저장됨"}
        </button>
      </div>

      <div className="wys-toolbar">
        {tb("제목", () => exec("formatBlock", "h2"), <Heading2 size={16} />)}
        {tb("본문", () => exec("formatBlock", "p"), <Pilcrow size={15} />)}
        <span className="wys-sep" />
        {tb("굵게", () => exec("bold"), <Bold size={15} />)}
        {tb("밑줄", () => exec("underline"), <Underline size={15} />)}
        {tb("포인트색", () => exec("foreColor", "#ff8a3d"), <span className="wys-color" style={{ color: "#ff8a3d" }}>가</span>)}
        {tb("검정", () => exec("foreColor", "#191f28"), <span className="wys-color">가</span>)}
        <span className="wys-sep" />
        {tb("왼쪽 정렬", () => exec("justifyLeft"), <AlignLeft size={15} />)}
        {tb("가운데 정렬", () => exec("justifyCenter"), <AlignCenter size={15} />)}
        {tb("구분선", () => exec("insertHorizontalRule"), <Minus size={15} />)}
        <span className="wys-sep" />
        <label className="admin-btn admin-btn-ghost admin-btn-sm" style={{ cursor: "pointer" }}>
          <ImagePlus size={14} /> {uploading ? "업로드 중…" : "사진 (여러 장 가능)"}
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
      </div>

      {loading && <div className="admin-empty">불러오는 중…</div>}
      <div
        ref={editorRef}
        className="rich-view wys-editor"
        style={loading ? { display: "none" } : undefined}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="게시판에 글 쓰듯 내용을 입력하세요. 사진 버튼으로 이미지를 본문 중간에 넣을 수 있어요."
        onInput={() => setDirty(true)}
        onPaste={onPaste}
      />
    </div>
  );
}
