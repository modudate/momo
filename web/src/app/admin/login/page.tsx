"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

// 관리자 전용 로그인 (PC) — 일반 회원 로그인(/login)과 분리
export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 이미 관리자로 로그인돼 있으면 바로 관리자 페이지로
  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d: { isAdmin: boolean }) => {
        if (d.isAdmin) router.replace("/admin");
      })
      .catch(() => {});
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    const supabase = getBrowserClient();
    if (!supabase) {
      setErrorMessage("인증 설정이 필요합니다.");
      return;
    }
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setIsSubmitting(false);
      setErrorMessage("아이디 또는 비밀번호를 확인해 주세요.");
      return;
    }
    // 로그인은 됐지만 관리자가 아닌 계정 차단
    const session = await fetch("/api/admin/session").then((r) => r.json()).catch(() => ({ isAdmin: false }));
    setIsSubmitting(false);
    if (!session.isAdmin) {
      await supabase.auth.signOut();
      setErrorMessage("관리자 권한이 없는 계정이에요.");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <div className="admin-login-root">
      <form onSubmit={handleSubmit} className="admin-login-card">
        <Image src="/logo_black.png" alt="모두의 모임" width={132} height={36} className="admin-login-logo" priority />
        <p className="admin-login-title">
          <LockKeyhole size={15} /> 관리자 로그인
        </p>

        <label className="admin-label" htmlFor="admin-email">아이디(이메일)</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          className="admin-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="admin-label" htmlFor="admin-password">비밀번호</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          className="admin-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {errorMessage && <p className="admin-login-error">{errorMessage}</p>}

        <button type="submit" className="admin-btn admin-btn-primary admin-login-submit" disabled={isSubmitting}>
          {isSubmitting ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </div>
  );
}
