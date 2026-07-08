"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MailCheck } from "lucide-react";
import TopNav from "@/components/TopNav";
import { getBrowserClient } from "@/lib/supabase/browser";

// 한국에서 주로 쓰는 이메일 도메인
const EMAIL_DOMAINS = [
  "naver.com",
  "gmail.com",
  "daum.net",
  "hanmail.net",
  "kakao.com",
  "nate.com",
  "icloud.com",
];

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [emailId, setEmailId] = useState(""); // @ 앞부분
  const [emailDomain, setEmailDomain] = useState("naver.com"); // 선택 도메인 ("custom"=직접입력)
  const [customDomain, setCustomDomain] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const domain = emailDomain === "custom" ? customDomain.trim() : emailDomain;
  const email = `${emailId.trim()}@${domain}`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");
    const supabase = getBrowserClient();
    if (!supabase) {
      setErrorMessage("인증 설정이 필요합니다.");
      return;
    }
    if (!emailId.trim() || !domain || !domain.includes(".")) {
      setErrorMessage("이메일을 확인해 주세요.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("비밀번호는 6자 이상이어야 해요.");
      return;
    }
    const year = Number(birthYear);
    if (birthYear && (year < 1940 || year > 2010)) {
      setErrorMessage("출생년도를 확인해 주세요. (예: 1995)");
      return;
    }
    setIsSubmitting(true);
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // 프로필은 DB 트리거가 메타데이터로 자동 생성
        data: { name, phone, birth_year: birthYear, gender },
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });
    setIsSubmitting(false);
    if (signUpError) {
      const status = signUpError.status;
      const rawMessage = signUpError.message?.toLowerCase() ?? "";
      let friendlyMessage = "가입에 실패했어요. 잠시 후 다시 시도해 주세요.";
      if (status === 429 || rawMessage.includes("rate limit")) {
        friendlyMessage =
          "메일 발송 한도를 초과했어요. 잠시 후(약 1시간 뒤) 다시 시도해 주세요.";
      } else if (rawMessage.includes("registered") || rawMessage.includes("already")) {
        friendlyMessage = "이미 가입된 이메일이에요. 로그인해 주세요.";
      } else if (rawMessage.includes("password")) {
        friendlyMessage = "비밀번호는 6자 이상이어야 해요.";
      } else if (rawMessage.includes("email") && rawMessage.includes("invalid")) {
        friendlyMessage = "이메일 형식을 확인해 주세요.";
      }
      setErrorMessage(friendlyMessage);
      return;
    }

    // 이메일 확인 OFF면 세션이 바로 생김 → 마이페이지로,
    // 이메일 확인 ON이면 세션이 없음 → "메일 확인" 안내
    if (signUpData.session) {
      router.push("/mypage");
      router.refresh();
    } else {
      setVerificationSent(true);
    }
  };

  if (verificationSent) {
    return (
      <div className="app-main pb-10">
        <TopNav title="회원가입" back />
        <div className="page-content pt-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-[var(--accent-primary-light)] flex items-center justify-center">
            <MailCheck size={30} className="text-[var(--accent-primary)]" />
          </div>
          <h2 className="tds-title-lg mt-5">인증 메일을 보냈어요</h2>
          <p className="tds-subtitle mt-2">
            <b>{email}</b> 으로 보낸 메일의
            <br />
            인증 링크를 눌러 가입을 완료해 주세요.
          </p>
          <p className="tds-caption mt-4">
            메일이 안 보이면 스팸함도 확인해 주세요.
          </p>
          <Link
            href="/login"
            className="inline-block mt-8 px-6 h-12 leading-[48px] rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white font-bold text-[15px]"
          >
            로그인하러 가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main pb-10">
      <TopNav title="회원가입" back />
      <form onSubmit={handleSubmit} className="page-content pt-6 flex flex-col gap-4">
        <h2 className="tds-title-lg mb-1">모두의 모임 시작하기</h2>

        <div className="fld">
          <label className="fld-label">성명</label>
          <input
            placeholder="이름"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="auth-input"
            required
          />
        </div>

        <div className="fld">
          <label className="fld-label">전화번호</label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="휴대폰 번호"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className="auth-input"
            required
          />
        </div>

        <div className="fld-row">
          <div className="fld" style={{ flex: 1, minWidth: 0 }}>
            <label className="fld-label">출생년도</label>
            <input
              type="number"
              inputMode="numeric"
              placeholder="예: 1995"
              value={birthYear}
              onChange={(event) => setBirthYear(event.target.value)}
              className="auth-input fld-full"
              min={1940}
              max={2010}
              required
            />
          </div>
          <div className="fld fld-gender">
            <label className="fld-label">성별</label>
            <select
              value={gender}
              onChange={(event) => setGender(event.target.value)}
              className="auth-input fld-full"
              required
            >
              <option value="">선택</option>
              <option value="male">남성</option>
              <option value="female">여성</option>
            </select>
          </div>
        </div>

        <div className="fld">
          <label className="fld-label">이메일</label>
          <div className="fld-email">
            <input
              inputMode="email"
              autoComplete="username"
              placeholder="이메일 아이디"
              value={emailId}
              onChange={(event) => setEmailId(event.target.value.replace(/@.*/, ""))}
              className="auth-input fld-email-id"
              required
            />
            <span className="fld-at">@</span>
            <select
              value={emailDomain}
              onChange={(event) => setEmailDomain(event.target.value)}
              className="auth-input fld-email-domain"
            >
              {EMAIL_DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
              <option value="custom">직접 입력</option>
            </select>
          </div>
          {emailDomain === "custom" && (
            <input
              inputMode="email"
              placeholder="도메인 입력 (예: company.co.kr)"
              value={customDomain}
              onChange={(event) => setCustomDomain(event.target.value)}
              className="auth-input mt-2"
              required
            />
          )}
        </div>

        <div className="fld">
          <label className="fld-label">비밀번호</label>
          <input
            type="password"
            autoComplete="new-password"
            placeholder="6자 이상"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="auth-input"
            required
          />
        </div>

        {errorMessage && <p className="text-[13px] text-[#FF4D4F]">{errorMessage}</p>}

        <button type="submit" className="tds-btn-primary mt-1" disabled={isSubmitting}>
          {isSubmitting ? "가입 중…" : "가입하고 시작하기"}
        </button>

        <p className="tds-caption text-center mt-2">
          이미 회원이신가요?{" "}
          <Link href="/login" className="font-bold text-[var(--accent-primary)]">
            로그인
          </Link>
        </p>
      </form>
    </div>
  );
}
