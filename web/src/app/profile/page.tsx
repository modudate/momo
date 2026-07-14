"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import { getBrowserClient } from "@/lib/supabase/browser";

type Profile = {
  email: string;
  name: string;
  phone: string;
  birth_year: number | null;
  gender: string;
};

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [welcome, setWelcome] = useState(false); // 최초 입력(소셜 로그인 직후) 안내

  useEffect(() => {
    setWelcome(new URLSearchParams(window.location.search).get("welcome") === "1");
    (async () => {
      const supabase = getBrowserClient();
      if (!supabase) {
        router.replace("/login");
        return;
      }
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/login?next=/profile");
        return;
      }
      const res = await fetch("/api/profile");
      if (res.ok) {
        const { profile } = (await res.json()) as { profile: Profile };
        setEmail(profile.email);
        setName(profile.name);
        setPhone(profile.phone);
        setBirthYear(profile.birth_year ? String(profile.birth_year) : "");
        setGender(profile.gender);
      }
      setLoading(false);
    })();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage("");

    const year = Number(birthYear);
    if (!name.trim()) return setErrorMessage("이름을 입력해 주세요.");
    if (phone.replace(/\D/g, "").length < 9) return setErrorMessage("전화번호를 확인해 주세요.");
    if (!year || year < 1940 || year > 2010) return setErrorMessage("출생년도를 확인해 주세요. (예: 1995)");
    if (!gender) return setErrorMessage("성별을 선택해 주세요.");

    setSaving(true);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, birth_year: year, gender }),
    });
    setSaving(false);
    if (!res.ok) {
      setErrorMessage("저장에 실패했어요. 잠시 후 다시 시도해 주세요.");
      return;
    }
    // 저장 후 마이페이지로 (welcome 이면 신청 흐름으로 자연스럽게 이어지도록 홈)
    router.push(welcome ? "/home" : "/mypage");
    router.refresh();
  };

  if (loading) {
    return (
      <div className="app-main">
        <TopNav title="내 정보" back backTo="/mypage" />
        <div className="page-content py-20 text-center">
          <p className="tds-caption">불러오는 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-main pb-10">
      <TopNav title="내 정보" back backTo="/mypage" />
      <form onSubmit={handleSubmit} className="page-content pt-6 flex flex-col gap-4">
        <h2 className="tds-title-lg mb-1">
          {welcome ? "개인정보를 입력해 주세요" : "내 정보 수정"}
        </h2>
        {welcome && (
          <p className="tds-caption -mt-2 mb-1">
            모임 신청에 필요한 정보예요. 한 번만 입력하면 다음부터 자동으로 채워져요.
          </p>
        )}

        <div className="fld">
          <label className="fld-label">성명</label>
          <input
            placeholder="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="auth-input"
            required
          />
        </div>

        <div className="fld">
          <label className="fld-label">전화번호</label>
          <input
            type="tel"
            inputMode="tel"
            placeholder="01012345678 (숫자만)"
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
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
              onChange={(e) => setBirthYear(e.target.value)}
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
              onChange={(e) => setGender(e.target.value)}
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
          <input value={email} className="auth-input" disabled readOnly />
          <p className="tds-caption mt-1">이메일은 변경할 수 없어요.</p>
        </div>

        {errorMessage && <p className="text-[13px] text-[#FF4D4F]">{errorMessage}</p>}

        <button type="submit" className="tds-btn-primary mt-1" disabled={saving}>
          {saving ? "저장 중…" : "저장"}
        </button>
      </form>
    </div>
  );
}
