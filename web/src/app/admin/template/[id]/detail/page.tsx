"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import DetailEditor from "../DetailEditor";

type Template = { id: string; title: string; home_section: string | null };

// 홈 노출 모임의 상세페이지 편집 (전용 화면)
export default function TemplateDetailEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [template, setTemplate] = useState<Template | null>(null);
  const [toast, setToast] = useState("");

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  useEffect(() => {
    fetch("/api/admin/templates")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { templates: Template[] } | null) => {
        const t = d?.templates.find((x) => x.id === id) ?? null;
        setTemplate(t);
      })
      .catch(() => {});
  }, [id]);

  return (
    <div className="admin-root">
      <div className="admin-main">
        <header className="admin-top">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-tertiary)] mb-1"
            >
              <ArrowLeft size={14} /> 상품 목록
            </Link>
            <h1 className="admin-top-title">{template?.title ?? "상품"} · 홈 상세페이지</h1>
            <p className="admin-top-sub">
              홈에서 이 모임 카드를 누르면 보이는 상세 내용이에요. 이미지는 폭 100%로 노출됩니다.
            </p>
          </div>
          <a
            href={`/moim/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-btn admin-btn-ghost"
          >
            <ExternalLink size={16} /> 상세페이지 미리보기
          </a>
        </header>

        <div className="admin-wrap">
          <DetailEditor templateId={id} flash={flash} />
        </div>
      </div>

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#16181d",
            color: "#fff",
            padding: "12px 20px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 700,
            zIndex: 90,
            boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
