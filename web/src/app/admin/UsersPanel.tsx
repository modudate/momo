"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, Ban } from "lucide-react";
import BlacklistPanel from "./BlacklistPanel";

type Member = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  gender: string | null;
  created_at: string;
  applied: number;
  attended: number;
  cancelled: number;
  blacklisted: boolean;
  black_memo: string | null;
};

const genderLabel = (g: string | null) => (g === "male" ? "남" : g === "female" ? "여" : "-");

export default function UsersPanel({ flash }: { flash: (m: string) => void }) {
  const [view, setView] = useState<"members" | "blacklist">("members");

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) setMembers((await res.json()).users);
    else setMembers([]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === "members") load();
  }, [view, load]);

  const filtered = useMemo(() => {
    const k = q.trim().toLowerCase();
    if (!k) return members;
    const kDigits = k.replace(/\D/g, "");
    return members.filter(
      (m) =>
        [m.name, m.email].filter(Boolean).some((v) => String(v).toLowerCase().includes(k)) ||
        (kDigits.length >= 3 && (m.phone ?? "").replace(/\D/g, "").includes(kDigits)),
    );
  }, [members, q]);

  const addBlack = async (m: Member) => {
    if (!m.phone) return;
    const memo = window.prompt(`${m.name ?? "회원"} 님을 블랙리스트에 등록합니다.\n사유(메모)를 입력하세요:`, "");
    if (memo === null) return; // 취소
    const res = await fetch("/api/admin/blacklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: m.name, phone: m.phone, memo }),
    });
    if (res.ok) {
      flash("블랙리스트에 등록했어요.");
      load();
    } else {
      flash("등록에 실패했어요.");
    }
  };

  return (
    <div>
      <div className="sales-seg">
        <button data-active={view === "members"} onClick={() => setView("members")}>
          회원 목록
        </button>
        <button data-active={view === "blacklist"} onClick={() => setView("blacklist")}>
          블랙리스트
        </button>
      </div>

      {view === "blacklist" ? (
        <BlacklistPanel flash={flash} />
      ) : (
        <>
          <div className="sales-filters">
            <div className="sales-search">
              <Search size={16} />
              <input
                className="sales-search-input"
                placeholder="회원명·이메일·전화 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>

          <div className="admin-card">
            <div className="sales-count">
              총 회원 <b>{members.length.toLocaleString()}</b>명
              {q && <span> · 검색 {filtered.length}명</span>}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>가입일</th>
                    <th>성별</th>
                    <th>회원명</th>
                    <th>이메일</th>
                    <th>전화번호</th>
                    <th>출생년도</th>
                    <th>신청</th>
                    <th>참석</th>
                    <th>취소</th>
                    <th>메모</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={11}><div className="admin-empty">불러오는 중…</div></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={11}><div className="admin-empty">회원이 없어요.</div></td></tr>
                  ) : (
                    filtered.map((m) => (
                      <tr key={m.id}>
                        <td>{m.created_at?.slice(0, 10) ?? "-"}</td>
                        <td>{genderLabel(m.gender)}</td>
                        <td className="font-semibold text-[var(--text-primary)]">
                          {m.blacklisted && (
                            <span className="res-black" title="블랙리스트">
                              <Ban size={11} /> 블랙
                            </span>
                          )}
                          {m.name ?? "-"}
                        </td>
                        <td>{m.email ?? "-"}</td>
                        <td>{m.phone ?? "-"}</td>
                        <td>{m.birth_year ?? "-"}</td>
                        <td>{m.applied}</td>
                        <td>{m.attended}</td>
                        <td>{m.cancelled}</td>
                        <td className="users-memo" title={m.black_memo ?? undefined}>{m.black_memo ?? "-"}</td>
                        <td>
                          <div className="flex justify-end">
                            {m.blacklisted ? (
                              <span className="tds-caption">등록됨</span>
                            ) : (
                              <button
                                className="admin-btn admin-btn-ghost admin-btn-sm"
                                onClick={() => addBlack(m)}
                                disabled={!m.phone}
                                title={m.phone ? "블랙리스트 등록" : "전화번호 없음"}
                              >
                                <Ban size={13} /> 블랙 등록
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
