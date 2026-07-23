"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function InquiryWritePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // 로그인 필요
  useEffect(() => {
    (async () => {
      const supabase = getBrowserClient();
      if (!supabase) {
        router.replace("/login?next=/contact/inquiry");
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/login?next=/contact/inquiry");
        return;
      }
      setChecking(false);
    })();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    if (!title.trim()) return setErrorMessage("제목을 입력해 주세요.");
    if (!content.trim()) return setErrorMessage("내용을 입력해 주세요.");

    setSaving(true);
    const res = await fetch("/api/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    });
    setSaving(false);
    if (!res.ok) {
      setErrorMessage("문의 등록에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    // 마이페이지 문의 내역으로
    router.push("/mypage#inquiries");
    router.refresh();
  };

  if (checking) {
    return (
      <div className="app-main">
        <TopNav title="1:1 문의" back backTo="/contact" />
        <div className="page-content py-20 text-center">
          <p className="tds-caption">불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main pb-10">
      <TopNav title="1:1 문의" back backTo="/contact" />
      <form onSubmit={submit} className="page-content pt-6 flex flex-col gap-4">
        <div>
          <h2 className="tds-title-lg mb-1">문의하기</h2>
          <p className="tds-caption">
            남겨주신 문의는 운영진이 확인 후 답변드려요. 답변은 <b>마이페이지 &gt; 내 문의</b>에서 확인할 수 있어요.
          </p>
        </div>

        <div className="fld">
          <label className="fld-label">제목</label>
          <input
            className="auth-input"
            placeholder="문의 제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
          />
        </div>

        <div className="fld">
          <label className="fld-label">내용</label>
          <textarea
            className="inq-editor"
            placeholder="문의하실 내용을 자세히 적어주세요.&#10;(예약 관련이면 모임 날짜·지점을 함께 적어주시면 빠르게 도와드려요.)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={5000}
            rows={10}
            required
          />
          <p className="tds-caption mt-1 text-right">{content.length} / 5000</p>
        </div>

        {errorMessage && <p className="text-[13px] text-[#FF4D4F]">{errorMessage}</p>}

        <button type="submit" className="tds-btn-primary" disabled={saving}>
          {saving ? "등록 중…" : "문의 남기기"}
        </button>
      </form>
    </div>
  );
}
