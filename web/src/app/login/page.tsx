"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { getBrowserClient } from "@/lib/supabase/browser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    const supabase = getBrowserClient();
    if (!supabase) {
      setErrorMessage("인증 설정이 필요합니다.");
      return;
    }
    setIsSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setIsSubmitting(false);
    if (signInError) {
      const status = signInError.status;
      const rawMessage = signInError.message?.toLowerCase() ?? "";
      let friendlyMessage = "이메일 또는 비밀번호를 확인해 주세요.";
      if (status === 429 || rawMessage.includes("rate limit")) {
        friendlyMessage = "요청이 많아요. 잠시 후 다시 시도해 주세요.";
      } else if (rawMessage.includes("not confirmed") || rawMessage.includes("confirm")) {
        friendlyMessage = "이메일 인증을 먼저 완료해 주세요. (메일함·스팸함 확인)";
      }
      setErrorMessage(friendlyMessage);
      return;
    }
    // ?next=/admin 처럼 돌아갈 곳이 지정돼 있으면 그리로 (내부 경로만)
    const next = new URLSearchParams(window.location.search).get("next");
    router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/mypage");
    router.refresh();
  };

  return (
    <div className="app-main pb-10">
      <TopNav title="로그인" back />
      <form onSubmit={handleSubmit} className="page-content pt-6 flex flex-col gap-3">
        <h2 className="tds-title-lg mb-2">다시 오셨네요 👋</h2>

        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="이메일"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="auth-input"
          required
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="비밀번호"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="auth-input"
          required
        />

        {errorMessage && <p className="text-[13px] text-[#FF4D4F]">{errorMessage}</p>}

        <button type="submit" className="tds-btn-primary mt-2" disabled={isSubmitting}>
          {isSubmitting ? "로그인 중…" : "로그인"}
        </button>

        <p className="tds-caption text-center mt-3">
          아직 회원이 아니신가요?{" "}
          <Link href="/signup" className="font-bold text-[var(--accent-primary)]">
            회원가입
          </Link>
        </p>
      </form>
    </div>
  );
}
