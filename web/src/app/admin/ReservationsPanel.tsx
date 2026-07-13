"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Users,
  CalendarClock,
  Wallet,
  Pencil,
  Check,
  CheckCheck,
  Download,
  ArrowRightLeft,
  Ban,
  Lock,
  LockOpen,
  Eye,
  EyeOff,
  Copy as CopyIcon,
} from "lucide-react";
import { regions, formatKRW } from "@/data/moim-data";
import { useBackdropClose } from "@/lib/useBackdropClose";
import { AdminDatePicker } from "./ui";

type ResMeeting = {
  id: string;
  region_slug: string;
  template_id: string | null;
  region_name: string;
  date: string;
  time: string;
  end_time: string | null;
  hidden: boolean;
  title: string;
  tag: string;
  price: number;
  capacity: number;
  description: string | null;
  place: string | null;
  closed_male: boolean;
  closed_female: boolean;
  virtual_male: number;
  virtual_female: number;
  joined: number;
  male: number;
  female: number;
  revenue: number;
};

type Attendee = {
  order_id: string;
  status: string;
  attended: boolean;
  gender: string | null;
  option_label: string | null;
  amount: number;
  member_name: string | null;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  blacklisted: boolean;
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

function todayKST() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

const regionAccent = (slug: string) =>
  regions.find((r) => r.slug === slug)?.accent ?? "#FF8A3D";

// "YYYY-MM-DD" → 요일 (로컬 타임존 파싱으로 UTC 오프셋 오차 방지)
function dowOf(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DOW[new Date(y, m - 1, d).getDay()];
}

// 모임 진행 상태 (KST 기준)
//  · 종료 : 종료시간이 지남 (종료시간 미설정이면 그 날짜가 지나면 종료)
//  · 진행중: 시작시간은 지났지만 아직 안 끝남
//  · 예정 : 아직 시작 전
function meetingPhase(
  m: { date: string; time: string; end_time: string | null },
  today: string,
  nowMs: number,
): "ended" | "ongoing" | "upcoming" {
  const startMs = new Date(`${m.date}T${m.time}:00+09:00`).getTime();

  let endMs: number;
  if (m.end_time) {
    endMs = new Date(`${m.date}T${m.end_time}:00+09:00`).getTime();
    // 자정을 넘기는 모임 (예: 21:00~01:00)
    if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000;
  } else {
    // 종료시간이 없으면 그 날짜가 지나면 끝난 것으로 본다
    endMs = new Date(`${m.date}T23:59:59+09:00`).getTime();
  }

  if (nowMs > endMs) return "ended";
  if (nowMs >= startMs) return "ongoing";
  // 날짜만 봐도 과거면 종료 (시간 파싱 실패 대비)
  if (m.date < today) return "ended";
  return "upcoming";
}

export default function ReservationsPanel({ flash }: { flash: (m: string) => void }) {
  const today = useMemo(() => todayKST(), []);
  // 진행중/종료 판정 기준 시각 (1분마다 갱신 → 모임이 끝나면 칩이 알아서 바뀜)
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7))); // 1-12
  const [region, setRegion] = useState("all");

  const [meetings, setMeetings] = useState<ResMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState<Record<string, string>>({}); // 공휴일

  // 참석자 명단 모달
  const [selected, setSelected] = useState<ResMeeting | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attLoading, setAttLoading] = useState(false);

  // 일정 이동 (어떤 신청자를 / 어느 일정으로)
  const [moveFor, setMoveFor] = useState<Attendee | null>(null);
  const [moveTarget, setMoveTarget] = useState("");

  // 가상구매 (성비 조절)
  const [vMale, setVMale] = useState(0);
  const [vFemale, setVFemale] = useState(0);
  const [vSaving, setVSaving] = useState(false);

  // 일정 추가/수정 모달
  const [meetingModal, setMeetingModal] = useState<{ open: boolean; editId: string | null }>({
    open: false,
    editId: null,
  });
  const emptyForm = {
    regionSlug: (regions[0]?.slug ?? "gangnam") as string,
    date: `${year}-${pad(month)}-01`,
    time: "19:30",
    endTime: "", // 비우면 자동으로 사라지지 않음
    title: "",
    tag: "정기모임",
    price: 25000,
    capacity: 16,
    place: "",
    description: "",
  };
  const [mForm, setMForm] = useState(emptyForm);

  // 모달 배경 클릭 닫기 (드래그 안전)
  const attendeeBackdrop = useBackdropClose(() => setSelected(null));
  const meetingBackdrop = useBackdropClose(() => setMeetingModal({ open: false, editId: null }));
  const moveBackdrop = useBackdropClose(() => {
    setMoveFor(null);
    setMoveTarget("");
  });
  const [saving, setSaving] = useState(false); // 엑셀 저장 중

  const monthKey = `${year}-${pad(month)}`;
  const nextMonthKey =
    month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;

  const load = useCallback(async () => {
    setLoading(true);
    // 이번 달 + 다음 달 함께 로드 → 월말 주 이어보기 & 일정이동 대상에 다음 달 포함
    const [r1, r2] = await Promise.all([
      fetch(`/api/admin/reservations?month=${monthKey}&region=${region}`),
      fetch(`/api/admin/reservations?month=${nextMonthKey}&region=${region}`),
    ]);
    const d1 = r1.ok ? ((await r1.json()) as { meetings: ResMeeting[] }).meetings : [];
    const d2 = r2.ok ? ((await r2.json()) as { meetings: ResMeeting[] }).meetings : [];
    setMeetings([...d1, ...d2]);
    setLoading(false);
  }, [monthKey, nextMonthKey, region]);

  useEffect(() => {
    load();
  }, [load]);

  // 해당 연도 공휴일 로드
  useEffect(() => {
    let active = true;
    fetch(`/api/holidays?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d?.holidays) setHolidays((prev) => ({ ...prev, ...d.holidays }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [year]);

  // 모달 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    if (selected || meetingModal.open || moveFor) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [selected, meetingModal.open, moveFor]);

  // 달력 그리드 (해당 월)
  const grid = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const byDate = new Map<string, ResMeeting[]>();
    meetings.forEach((m) => {
      const list = byDate.get(m.date) ?? [];
      list.push(m);
      byDate.set(m.date, list);
    });
    const cells: { date: string | null; items: ResMeeting[]; other?: boolean }[] = [];
    for (let i = 0; i < firstDow; i++) cells.push({ date: null, items: [] });
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${pad(month)}-${pad(d)}`;
      cells.push({ date: ds, items: byDate.get(ds) ?? [] });
    }
    // 마지막 주는 다음 달 첫 주 날짜로 이어서 표시
    let nd = 1;
    const ny = month === 12 ? year + 1 : year;
    const nm = month === 12 ? 1 : month + 1;
    while (cells.length % 7 !== 0) {
      const ds = `${ny}-${pad(nm)}-${pad(nd)}`;
      cells.push({ date: ds, items: byDate.get(ds) ?? [], other: true });
      nd += 1;
    }
    return cells;
  }, [year, month, meetings]);

  // 통계
  const monthStats = useMemo(() => {
    const cur = meetings.filter((m) => m.date.startsWith(monthKey));
    const people = cur.reduce((s, m) => s + m.joined, 0);
    const revenue = cur.reduce((s, m) => s + m.revenue, 0);
    return { people, revenue, ops: cur.length };
  }, [meetings, monthKey]);

  const todayStats = useMemo(() => {
    const todays = meetings.filter((m) => m.date === today);
    return {
      ops: todays.length,
      people: todays.reduce((s, m) => s + m.joined, 0),
      revenue: todays.reduce((s, m) => s + m.revenue, 0),
    };
  }, [meetings, today]);

  const goPrev = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else setMonth((m) => m + 1);
  };
  const goToday = () => {
    setYear(Number(today.slice(0, 4)));
    setMonth(Number(today.slice(5, 7)));
  };

  // 참석자 명단 열기
  const openAttendees = async (m: ResMeeting) => {
    setSelected(m);
    setVMale(m.virtual_male ?? 0);
    setVFemale(m.virtual_female ?? 0);
    setAttLoading(true);
    setAttendees([]);
    const res = await fetch(`/api/admin/reservations/attendees?meetingId=${m.id}`);
    if (res.ok) {
      const data = (await res.json()) as { attendees: Attendee[] };
      setAttendees(data.attendees);
    }
    setAttLoading(false);
  };

  const toggleAttended = async (orderId: string, next: boolean) => {
    if (!selected) return;
    const snapshot = attendees;
    setAttendees((prev) =>
      prev.map((a) => (a.order_id === orderId ? { ...a, attended: next } : a)),
    );
    const res = await fetch("/api/admin/reservations/attendees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, attended: next, meetingId: selected.id }),
    });
    if (!res.ok) {
      setAttendees(snapshot); // 실패 시 롤백
      flash("참석 체크 저장에 실패했어요. 다시 시도해 주세요.");
    }
  };

  // 명단을 엑셀(xlsx)로 저장 — 남/여 두 블록 나란히 (명단 양식)
  const saveExcel = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/admin/reservations/attendees/xlsx?meetingId=${encodeURIComponent(selected.id)}`,
      );
      if (!res.ok) throw new Error("failed");

      // 서버가 지정한 한글 파일명 사용
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/)?.[1];
      const filename = encoded
        ? decodeURIComponent(encoded)
        : `${selected.title}_${selected.date}_명단.xlsx`;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      flash("엑셀 저장에 실패했어요.");
    } finally {
      setSaving(false);
    }
  };

  // 가상구매 저장
  const saveVirtual = async () => {
    if (!selected) return;
    setVSaving(true);
    const res = await fetch("/api/admin/reservations/virtual", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: selected.id, male: vMale, female: vFemale }),
    });
    setVSaving(false);
    if (res.ok) {
      setSelected((s) => (s ? { ...s, virtual_male: vMale, virtual_female: vFemale } : s));
      flash("가상구매를 저장했어요. 손님 화면에 바로 반영됩니다.");
      load();
    } else {
      flash("저장에 실패했어요.");
    }
  };

  // 전화번호 복사
  const copyPhone = async (phone: string | null) => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      flash(`전화번호 복사: ${phone}`);
    } catch {
      flash("복사에 실패했어요.");
    }
  };

  // A2 전체 참석 토글
  const markAllAttended = async (next: boolean) => {
    if (!selected) return;
    setAttendees((prev) => prev.map((a) => ({ ...a, attended: next })));
    const res = await fetch("/api/admin/reservations/attendees", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: selected.id, allAttended: next }),
    });
    if (!res.ok) {
      flash("전체 참석 처리에 실패했어요.");
      openAttendees(selected); // 재동기화
    } else {
      flash(next ? "전체 참석 처리했어요." : "전체 참석을 해제했어요.");
    }
  };

  // A3 성비 임시마감 / 재오픈
  const toggleClose = async (g: "male" | "female", closed: boolean) => {
    if (!selected) return;
    const res = await fetch("/api/admin/reservations/close", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId: selected.id, gender: g, closed }),
    });
    if (res.ok) {
      setSelected((s) =>
        s ? { ...s, ...(g === "male" ? { closed_male: closed } : { closed_female: closed }) } : s,
      );
      flash(closed ? (g === "male" ? "남성 마감했어요." : "여성 마감했어요.") : "다시 열었어요.");
      load();
    } else {
      flash("처리에 실패했어요.");
    }
  };

  // A1 일정 이동
  const moveTargets = useMemo(() => {
    if (!selected) return [];
    return meetings.filter(
      (m) =>
        m.id !== selected.id &&
        (selected.template_id
          ? m.template_id === selected.template_id
          : m.region_slug === selected.region_slug),
    );
  }, [meetings, selected]);

  const doMove = async () => {
    if (!moveFor || !moveTarget || !selected) return;
    const res = await fetch("/api/admin/reservations/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: moveFor.order_id, targetMeetingId: moveTarget }),
    });
    if (res.ok) {
      flash("일정을 이동했어요.");
      setMoveFor(null);
      setMoveTarget("");
      openAttendees(selected); // 현재 명단 새로고침(이동된 사람 빠짐)
      load();
    } else {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      flash(
        b.error === "target_full"
          ? "옮길 일정에 자리가 없어요."
          : b.error === "option_not_in_target"
            ? "그 일정엔 같은 옵션이 없어요."
            : "이동에 실패했어요.",
      );
    }
  };

  // 일정 추가/수정
  const openCreate = () => {
    setMForm({ ...emptyForm, date: `${year}-${pad(month)}-01` });
    setMeetingModal({ open: true, editId: null });
  };
  const openEdit = (m: ResMeeting) => {
    setMForm({
      regionSlug: m.region_slug,
      date: m.date,
      time: m.time,
      endTime: m.end_time ?? "",
      title: m.title,
      tag: m.tag,
      price: m.price,
      capacity: m.capacity,
      place: m.place ?? "",
      description: m.description ?? "",
    });
    setMeetingModal({ open: true, editId: m.id });
  };

  // 손님 화면에서 강제로 내리기 / 다시 올리기
  const toggleHidden = async (m: ResMeeting) => {
    const next = !m.hidden;
    const res = await fetch("/api/admin/meetings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, hidden: next }),
    });
    if (res.ok) {
      flash(next ? "손님 화면에서 내렸어요." : "손님 화면에 다시 올렸어요.");
      setSelected((s) => (s && s.id === m.id ? { ...s, hidden: next } : s));
      load();
    } else {
      flash("변경에 실패했어요.");
    }
  };
  const saveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const editId = meetingModal.editId;
    const isEdit = Boolean(editId);
    const res = await fetch("/api/admin/meetings", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEdit ? { ...mForm, id: editId } : mForm),
    });
    if (res.ok) {
      setMeetingModal({ open: false, editId: null });
      flash(isEdit ? "일정을 수정했어요." : "일정을 등록했어요.");
      // 수정한 일정이 명단 모달에 떠있으면 헤더·명단 모두 갱신
      if (isEdit && selected?.id === editId) {
        setSelected((s) => (s ? { ...s, ...mForm, region_slug: mForm.regionSlug } : s));
        const aRes = await fetch(`/api/admin/reservations/attendees?meetingId=${editId}`);
        if (aRes.ok) {
          const data = (await aRes.json()) as { attendees: Attendee[] };
          setAttendees(data.attendees);
        }
      }
      load();
    } else {
      flash("저장에 실패했어요.");
    }
  };

  const male = attendees.filter((a) => a.gender === "male");
  const female = attendees.filter((a) => a.gender === "female");
  const others = attendees.filter((a) => a.gender !== "male" && a.gender !== "female");

  return (
    <div className="res-layout">
      {/* 좌측: 달력 */}
      <div className="res-cal-col">
        <div className="res-toolbar">
          <div className="res-monthnav">
            <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={goToday}>
              오늘
            </button>
            <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={goPrev}>
              <ChevronLeft size={16} />
            </button>
            <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={goNext}>
              <ChevronRight size={16} />
            </button>
            <span className="res-month-title">
              {year}년 {month}월
            </span>
          </div>
          <div className="res-toolbar-right">
            <select
              className="admin-select res-region-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option value="all">전체 지점</option>
              {regions.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                </option>
              ))}
            </select>
            <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={openCreate}>
              <Plus size={15} /> 외부 일정 등록
            </button>
          </div>
        </div>

        <div className="res-cal">
          <div className="res-cal-head">
            {DOW.map((d, i) => (
              <div key={d} className={`res-dow ${i === 0 ? "res-dow-sun" : ""} ${i === 6 ? "res-dow-sat" : ""}`}>
                {d}
              </div>
            ))}
          </div>
          {loading ? (
            <div className="admin-empty" style={{ padding: 48 }}>불러오는 중…</div>
          ) : (
            <div className="res-cal-body">
              {grid.map((cell, idx) => {
                const dow = idx % 7;
                const isToday = cell.date === today;
                return (
                  <div
                    key={cell.date ?? `empty-${idx}`}
                    className={`res-cell ${!cell.date ? "res-cell-empty" : ""} ${cell.other ? "res-cell-other" : ""} ${isToday ? "res-cell-today" : ""}`}
                  >
                    {cell.date && (
                      <>
                        <div
                          className={`res-cell-num ${dow === 0 || holidays[cell.date] ? "res-num-sun" : ""} ${dow === 6 && !holidays[cell.date] ? "res-num-sat" : ""}`}
                        >
                          {Number(cell.date.slice(8, 10))}
                          {holidays[cell.date] && (
                            <span className="res-holiday" title={holidays[cell.date]}>
                              {holidays[cell.date]}
                            </span>
                          )}
                        </div>
                        <div className="res-cell-list">
                          {cell.items.map((m) => {
                            const shown = m.joined + (m.virtual_male ?? 0) + (m.virtual_female ?? 0);
                            const full = shown >= m.capacity;
                            const phase = meetingPhase(m, today, nowMs);
                            const isTodayChip = m.date === today;
                            // 끝난 모임(종료)이 가장 우선 → 회색. 그다음 마감, 당일 강조 순.
                            const chipClass =
                              phase === "ended"
                                ? "res-chip is-ended"
                                : full
                                  ? "res-chip is-closed"
                                  : phase === "ongoing"
                                    ? "res-chip is-ongoing"
                                    : isTodayChip
                                      ? "res-chip is-today"
                                      : "res-chip";
                            const statusText =
                              phase === "ended"
                                ? "종료"
                                : full
                                  ? "마감"
                                  : phase === "ongoing"
                                    ? "진행중"
                                    : "진행예정";
                            return (
                              <button
                                key={m.id}
                                type="button"
                                className={chipClass}
                                onClick={() => openAttendees(m)}
                                title={`${m.region_name} ${m.title} · ${m.time}`}
                              >
                                <span className="res-chip-name">
                                  {m.region_name} {m.title}
                                </span>
                                <span className="res-chip-time">{m.time}</span>
                                <span className="res-chip-status">
                                  {statusText} {shown}/{m.capacity}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 우측: 요약 */}
      <aside className="res-side">
        <div className="res-summary">
          <p className="res-summary-label">{today.slice(5, 7)}월 {Number(today.slice(8, 10))}일 오늘의 일정</p>
          <div className="res-summary-row">
            <Users size={15} /> 총 예약 인원 <b>{todayStats.people.toLocaleString()}명</b>
          </div>
          <div className="res-summary-row">
            <CalendarClock size={15} /> 운영 일정 <b>{todayStats.ops}건</b>
          </div>
          <div className="res-summary-row">
            <Wallet size={15} /> 오늘 예상 매출 <b>{formatKRW(todayStats.revenue)}</b>
          </div>
        </div>

        <div className="res-summary">
          <p className="res-summary-label">{year}년 {month}월 현황</p>
          <div className="res-summary-row">
            <Users size={15} /> 총 인원 <b>{monthStats.people.toLocaleString()}명</b>
          </div>
          <div className="res-summary-row">
            <CalendarClock size={15} /> 운영 일정 <b>{monthStats.ops}건</b>
          </div>
          <div className="res-summary-row">
            <Wallet size={15} /> 예상 매출 <b>{formatKRW(monthStats.revenue)}</b>
          </div>
        </div>

        <div className="res-note">
          <p className="res-note-title">안내</p>
          <ol>
            <li>날짜칸의 일정을 클릭하면 성별로 분리된 참석자 명단이 열려요.</li>
            <li>명단의 <b>참석여부</b>는 현장 체크인용이에요. 체크하면 즉시 저장돼요.</li>
            <li><b>비고</b>는 구매한 옵션이에요. 성별·티켓이 맞게 결제됐는지 확인하세요.</li>
            <li>지점/일시 변경은 명단 상단의 <b>일정 수정</b>에서 가능해요.</li>
          </ol>
        </div>
      </aside>

      {/* 참석자 명단 모달 */}
      {selected && (
        <div className="admin-modal-back" {...attendeeBackdrop}>
          <div className="res-attend-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <div>
                <span className="admin-modal-title">{selected.title}</span>
                <p className="tds-caption" style={{ marginTop: 2 }}>
                  {selected.region_name} · {Number(selected.date.slice(5, 7))}월{" "}
                  {Number(selected.date.slice(8, 10))}일 ({dowOf(selected.date)}) ·{" "}
                  {selected.time}
                </p>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-end">
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => markAllAttended(true)}
                  disabled={attendees.length === 0}
                  title="명단 전원을 참석 처리"
                >
                  <CheckCheck size={14} /> 전체 참석
                </button>
                <button
                  className={`admin-btn admin-btn-sm ${selected.closed_male ? "admin-btn-primary" : "admin-btn-ghost"}`}
                  onClick={() => toggleClose("male", !selected.closed_male)}
                  title="남성 신청 임시마감 / 재오픈"
                >
                  {selected.closed_male ? <LockOpen size={14} /> : <Lock size={14} />}
                  {selected.closed_male ? "남 재오픈" : "남 마감"}
                </button>
                <button
                  className={`admin-btn admin-btn-sm ${selected.closed_female ? "admin-btn-primary" : "admin-btn-ghost"}`}
                  onClick={() => toggleClose("female", !selected.closed_female)}
                  title="여성 신청 임시마감 / 재오픈"
                >
                  {selected.closed_female ? <LockOpen size={14} /> : <Lock size={14} />}
                  {selected.closed_female ? "여 재오픈" : "여 마감"}
                </button>
                <button
                  className={`admin-btn admin-btn-sm ${selected.hidden ? "admin-btn-primary" : "admin-btn-ghost"}`}
                  onClick={() => toggleHidden(selected)}
                  title="손님 화면(일정 목록)에서 이 모임을 내리거나 다시 올려요"
                >
                  {selected.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  {selected.hidden ? "다시 노출" : "손님화면 내리기"}
                </button>
                <button
                  className="admin-btn admin-btn-primary admin-btn-sm"
                  onClick={saveExcel}
                  disabled={saving || attendees.length === 0}
                >
                  <Download size={14} /> {saving ? "저장 중…" : "엑셀 저장"}
                </button>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm"
                  onClick={() => openEdit(selected)}
                >
                  <Pencil size={14} /> 일정 수정
                </button>
                <button
                  className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                  onClick={() => setSelected(null)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="res-attend-body">
              {/* 가상구매 (성비 조절) — 손님에게 실구매와 합산 표시 */}
              <div className="vbuy">
                <span className="vbuy-title">가상구매</span>
                <label className="vbuy-field">
                  남
                  <input
                    type="number"
                    min={0}
                    value={vMale}
                    max={500}
                    onChange={(e) => setVMale(Math.min(500, Math.max(0, Number(e.target.value) || 0)))}
                  />
                </label>
                <label className="vbuy-field">
                  여
                  <input
                    type="number"
                    min={0}
                    value={vFemale}
                    max={500}
                    onChange={(e) => setVFemale(Math.min(500, Math.max(0, Number(e.target.value) || 0)))}
                  />
                </label>
                <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={saveVirtual} disabled={vSaving}>
                  {vSaving ? "저장 중…" : "저장"}
                </button>
                <span className="vbuy-hint">
                  손님 화면 표시(저장 시): 남 {selected.male + vMale} · 여 {selected.female + vFemale} · 현재{" "}
                  {selected.joined + vMale + vFemale} / 전체 {selected.capacity}
                </span>
              </div>
              {attLoading ? (
                <div className="admin-empty" style={{ padding: 40 }}>명단 불러오는 중…</div>
              ) : attendees.length === 0 ? (
                <div className="admin-empty" style={{ padding: 40 }}>아직 신청자가 없어요.</div>
              ) : (
                <div className="res-capture">
                  <div className="res-capture-head">
                    <div className="res-capture-title">{selected.title}</div>
                    <div className="res-capture-sub">
                      {selected.region_name} · {Number(selected.date.slice(5, 7))}월{" "}
                      {Number(selected.date.slice(8, 10))}일 ({dowOf(selected.date)}) ·{" "}
                      {selected.time} · 참석 {attendees.length}명 (남 {male.length} / 여 {female.length})
                    </div>
                  </div>
                  <div className="res-attend-grid">
                    <AttendList
                      title={`남 (${male.length})`}
                      tone="male"
                      rows={male}
                      onToggle={toggleAttended}
                      onMove={(a) => { setMoveFor(a); setMoveTarget(""); }}
                      copyPhone={copyPhone}
                    />
                    <AttendList
                      title={`여 (${female.length})`}
                      tone="female"
                      rows={female}
                      onToggle={toggleAttended}
                      onMove={(a) => { setMoveFor(a); setMoveTarget(""); }}
                      copyPhone={copyPhone}
                    />
                    {others.length > 0 && (
                      <AttendList
                        title={`옵션 미지정 (${others.length})`}
                        tone="other"
                        rows={others}
                        onToggle={toggleAttended}
                        onMove={(a) => { setMoveFor(a); setMoveTarget(""); }}
                        copyPhone={copyPhone}
                        full
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      {meetingModal.open && (
        <div className="admin-modal-back" {...meetingBackdrop}>
          <form className="admin-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveMeeting}>
            <div className="admin-modal-head">
              <span className="admin-modal-title">
                {meetingModal.editId ? "일정 수정" : "외부 일정 등록"}
              </span>
              <button
                type="button"
                className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                onClick={() => setMeetingModal({ open: false, editId: null })}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <div className="admin-field-row">
                <div className="admin-field">
                  <label className="admin-label">지점</label>
                  <select
                    className="admin-select"
                    value={mForm.regionSlug}
                    onChange={(e) => setMForm({ ...mForm, regionSlug: e.target.value })}
                  >
                    {regions.map((r) => (
                      <option key={r.slug} value={r.slug}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-field">
                  <label className="admin-label">태그</label>
                  <input
                    className="admin-input"
                    value={mForm.tag}
                    onChange={(e) => setMForm({ ...mForm, tag: e.target.value })}
                  />
                </div>
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label className="admin-label">날짜</label>
                  <AdminDatePicker
                    value={mForm.date}
                    onChange={(v) => setMForm({ ...mForm, date: v })}
                    placeholder="날짜 선택"
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">시작 시간</label>
                  <input
                    className="admin-input"
                    type="time"
                    value={mForm.time}
                    onChange={(e) => setMForm({ ...mForm, time: e.target.value })}
                    required
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">종료 시간</label>
                  <input
                    className="admin-input"
                    type="time"
                    value={mForm.endTime}
                    onChange={(e) => setMForm({ ...mForm, endTime: e.target.value })}
                  />
                  <p className="admin-hint">지나면 손님 화면에서 자동으로 사라져요 (비우면 유지)</p>
                </div>
              </div>
              <div className="admin-field">
                <label className="admin-label">제목</label>
                <input
                  className="admin-input"
                  value={mForm.title}
                  onChange={(e) => setMForm({ ...mForm, title: e.target.value })}
                  required
                />
              </div>
              <div className="admin-field">
                <label className="admin-label">소개 문구 (이 일정만 다르게 쓸 때)</label>
                <input
                  className="admin-input"
                  value={mForm.description}
                  onChange={(e) => setMForm({ ...mForm, description: e.target.value })}
                  placeholder="비우면 예약 상품의 '상세 소개'가 그대로 쓰여요"
                />
                <p className="admin-hint">
                  손님 목록의 회색 한 줄 + 신청 페이지의 &apos;모임 소개&apos;에 쓰여요.
                </p>
              </div>
              <div className="admin-field-row">
                <div className="admin-field">
                  <label className="admin-label">가격(원)</label>
                  <input
                    className="admin-input"
                    type="number"
                    value={mForm.price}
                    onChange={(e) => setMForm({ ...mForm, price: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="admin-field">
                  <label className="admin-label">정원</label>
                  <input
                    className="admin-input"
                    type="number"
                    value={mForm.capacity}
                    onChange={(e) => setMForm({ ...mForm, capacity: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <div className="admin-field">
                <label className="admin-label">장소</label>
                <input
                  className="admin-input"
                  value={mForm.place}
                  onChange={(e) => setMForm({ ...mForm, place: e.target.value })}
                />
              </div>
            </div>
            <div className="admin-modal-foot">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                style={{ flex: 1 }}
                onClick={() => setMeetingModal({ open: false, editId: null })}
              >
                취소
              </button>
              <button type="submit" className="admin-btn admin-btn-primary" style={{ flex: 2 }}>
                {meetingModal.editId ? "수정 저장" : "등록"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 일정 이동 모달 */}
      {moveFor && (
        <div className="admin-modal-back" {...moveBackdrop}>
          <div className="admin-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <span className="admin-modal-title">일정 이동</span>
              <button
                className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                onClick={() => { setMoveFor(null); setMoveTarget(""); }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <p className="tds-subtitle">
                <b>{moveFor.name ?? "신청자"}</b> 님
                {moveFor.option_label ? ` (${moveFor.option_label})` : ""} 을(를) 옮길 일정을 선택하세요.
              </p>
              {selected && (
                <p className="tds-caption">
                  현재: {selected.title} · {Number(selected.date.slice(5, 7))}월{" "}
                  {Number(selected.date.slice(8, 10))}일 {selected.time}
                </p>
              )}
              <div className="admin-field">
                <label className="admin-label">옮길 일정 (이 달 · 같은 상품)</label>
                <select
                  className="admin-select"
                  value={moveTarget}
                  onChange={(e) => setMoveTarget(e.target.value)}
                >
                  <option value="">대상 일정 선택</option>
                  {moveTargets.map((m) => (
                    <option key={m.id} value={m.id}>
                      {Number(m.date.slice(5, 7))}/{Number(m.date.slice(8, 10))} {m.time} · {m.title}{" "}
                      (남{m.male}/여{m.female} · 정원{m.capacity})
                    </option>
                  ))}
                </select>
              </div>
              {moveTargets.length === 0 && (
                <p className="tds-caption" style={{ color: "#e8590c" }}>
                  이 달에 같은 상품의 다른 일정이 없어요. 달력에서 해당 월로 이동한 뒤 다시 시도하세요.
                </p>
              )}
            </div>
            <div className="admin-modal-foot">
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                style={{ flex: 1 }}
                onClick={() => { setMoveFor(null); setMoveTarget(""); }}
              >
                취소
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                style={{ flex: 2 }}
                disabled={!moveTarget}
                onClick={doMove}
              >
                <ArrowRightLeft size={15} /> 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AttendList({
  title,
  tone,
  rows,
  onToggle,
  onMove,
  copyPhone,
  full,
}: {
  title: string;
  tone: "male" | "female" | "other";
  rows: Attendee[];
  onToggle: (orderId: string, next: boolean) => void;
  onMove: (a: Attendee) => void;
  copyPhone: (phone: string | null) => void;
  full?: boolean;
}) {
  return (
    <div className={`res-attend-col ${full ? "res-attend-col-full" : ""}`}>
      <div className={`res-attend-th res-tone-${tone}`}>{title}</div>
      <div className="admin-table-wrap">
        <table className="admin-table res-attend-table">
          <thead>
            <tr>
              <th>NO.</th>
              <th>참석</th>
              <th>회원명</th>
              <th>이름</th>
              <th>전화번호</th>
              <th>출생</th>
              <th>비고(옵션)</th>
              <th>이동</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="admin-empty" style={{ padding: 18 }}>없음</div>
                </td>
              </tr>
            )}
            {rows.map((a, i) => (
              <tr key={a.order_id} className={a.attended ? "res-row-on" : ""}>
                <td>{i + 1}</td>
                <td>
                  <button
                    type="button"
                    className={`res-check ${a.attended ? "is-on" : ""}`}
                    onClick={() => onToggle(a.order_id, !a.attended)}
                    role="checkbox"
                    aria-checked={a.attended}
                    aria-label={`${a.name ?? "신청자"} 참석 ${a.attended ? "취소" : "체크"}`}
                    title={a.attended ? "참석 취소" : "참석 체크"}
                  >
                    {a.attended && <Check size={13} />}
                  </button>
                </td>
                <td>{a.member_name ?? "-"}</td>
                <td className="font-semibold text-[var(--text-primary)]">
                  {a.blacklisted && (
                    <span className="res-black" title="블랙리스트 일치">
                      <Ban size={11} /> 블랙
                    </span>
                  )}
                  {a.name ?? "-"}
                </td>
                <td>
                  {a.phone ? (
                    <button
                      type="button"
                      className="sales-phone"
                      onClick={() => copyPhone(a.phone)}
                      title="전화번호 복사"
                    >
                      {a.phone} <CopyIcon size={12} />
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
                <td>{a.birth_year ?? "-"}</td>
                <td>
                  <div className="res-bigo">
                    {a.option_label ? (
                      <span className="res-opt-badge">{a.option_label}</span>
                    ) : (
                      <span className="tds-caption">단일가</span>
                    )}
                    <span className={`res-pay res-pay-${a.status}`}>
                      {a.status === "paid" ? "결제완료" : a.status === "pending" ? "결제대기" : a.status}
                    </span>
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon"
                    onClick={() => onMove(a)}
                    title="다른 일정으로 이동"
                  >
                    <ArrowRightLeft size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
