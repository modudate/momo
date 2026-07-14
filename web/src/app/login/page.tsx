"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { getBrowserClient } from "@/lib/supabase/browser";

// 구글 로고 (공식 4색)
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

// 돌아갈 내부 경로만 허용 (오픈 리다이렉트 방지)
function safeNext(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/mypage";
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // 콜백에서 실패해 돌아온 경우 안내
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setErrorMessage("구글 로그인에 실패했어요. 다시 시도해 주세요.");
    }
  }, []);

  const handleGoogle = async () => {
    setErrorMessage("");
    const supabase = getBrowserClient();
    if (!supabase) {
      setErrorMessage("인증 설정이 필요합니다.");
      return;
    }
    setGoogleLoading(true);
    // 구글 인증 후 /auth/callback 으로 돌아와 세션을 만든다. next 는 그 뒤 이동할 곳.
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext())}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setGoogleLoading(false);
      setErrorMessage("구글 로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
    // 성공하면 구글 페이지로 이동하므로 여기서 끝
  };

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
    router.push(safeNext());
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

        <div className="auth-divider">
          <span>또는</span>
        </div>

        <button
          type="button"
          className="auth-google"
          onClick={handleGoogle}
          disabled={googleLoading}
        >
          <GoogleMark />
          {googleLoading ? "구글로 이동 중…" : "Google 계정으로 계속하기"}
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
