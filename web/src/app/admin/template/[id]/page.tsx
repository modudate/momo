"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Repeat,
  CalendarCheck,
  ArrowLeft,
  Pencil,
  Plus,
  Tag,
} from "lucide-react";
import { categoryLabel } from "@/data/taxonomy";
import { formatKRW } from "@/data/moim-data";
import { AdminDatePicker } from "../../ui";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const GENDERS = [
  { key: "male", label: "남" },
  { key: "female", label: "여" },
  { key: "any", label: "공용" },
];
function genderLabel(key: string) {
  return GENDERS.find((g) => g.key === key)?.label ?? "공용";
}

type TemplateOption = {
  id: string;
  label: string;
  gender: string;
  age_group: string;
  price: number;
  capacity: number;
  sort: number;
};

type Template = {
  id: string;
  category: string;
  region_slug: string;
  age_group: string;
  title: string;
  price: number;
  capacity: number;
};
type Session = { id: string; date: string; time: string; capacity: number; joined: number };

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function ymd(year: number, month: number, day: number) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}
function parseLocal(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export default function TemplateSchedulePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [template, setTemplate] = useState<Template | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [toast, setToast] = useState("");

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [time, setTime] = useState("19:30");

  const [weekdays, setWeekdays] = useState<Set<number>>(new Set());
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [recurTime, setRecurTime] = useState("19:30");

  const [options, setOptions] = useState<TemplateOption[]>([]);
  const emptyOption = { label: "", gender: "male", ageGroup: "", price: 30000, capacity: 8 };
  const [optionForm, setOptionForm] = useState(emptyOption);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const loadSessions = useCallback(async () => {
    const res = await fetch(`/api/admin/templates/sessions?templateId=${id}`);
    if (res.ok) setSessions((await res.json()).sessions);
  }, [id]);

  const loadOptions = useCallback(async () => {
    const res = await fetch(`/api/admin/templates/options?templateId=${id}`);
    if (res.ok) setOptions((await res.json()).options);
  }, [id]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/session");
      const data = (await res.json().catch(() => ({ isAdmin: false }))) as { isAdmin: boolean };
      if (!data.isAdmin) {
        router.replace("/home");
        return;
      }
      setAuthChecked(true);
      const tplRes = await fetch("/api/admin/templates");
      if (tplRes.ok) {
        const tpl = (await tplRes.json()) as { templates: Template[] };
        setTemplate(tpl.templates.find((item) => item.id === id) ?? null);
      }
      loadSessions();
      loadOptions();
    })();
  }, [id, router, loadSessions, loadOptions]);

  const saveOption = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!optionForm.label.trim()) {
      flash("옵션명을 입력해 주세요.");
      return;
    }
    const isEdit = Boolean(editingOptionId);
    const res = await fetch("/api/admin/templates/options", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isEdit ? { ...optionForm, id: editingOptionId } : { ...optionForm, templateId: id },
      ),
    });
    if (res.ok) {
      setOptionForm(emptyOption);
      setEditingOptionId(null);
      flash(isEdit ? "옵션을 수정했어요." : "옵션을 추가했어요.");
      loadOptions();
    } else {
      flash("옵션 저장에 실패했어요.");
    }
  };

  const editOption = (option: TemplateOption) => {
    setEditingOptionId(option.id);
    setOptionForm({
      label: option.label,
      gender: option.gender,
      ageGroup: option.age_group,
      price: option.price,
      capacity: option.capacity,
    });
  };

  const deleteOption = async (optionId: string) => {
    const res = await fetch(`/api/admin/templates/options?id=${optionId}`, { method: "DELETE" });
    if (res.ok) loadOptions();
  };

  if (!authChecked) {
    return <div className="admin-root"><div className="admin-empty" style={{ margin: "auto" }}>확인 중…</div></div>;
  }

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  const sessionDates = new Set(sessions.map((session) => session.date));

  const moveMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 0) { nextMonth = 11; nextYear -= 1; }
    else if (nextMonth > 11) { nextMonth = 0; nextYear += 1; }
    setMonth(nextMonth);
    setYear(nextYear);
  };

  const toggleDate = (dateKey: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const generate = async (slots: { date: string; time: string }[]) => {
    if (slots.length === 0) { flash("선택된 날짜가 없어요."); return; }
    const res = await fetch("/api/admin/templates/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id, slots }),
    });
    if (res.ok) {
      const data = (await res.json()) as { created: number };
      flash(`${data.created}개 일정을 생성했어요.`);
      setSelectedDates(new Set());
      loadSessions();
    } else {
      flash("생성에 실패했어요.");
    }
  };

  const generateSelected = () => generate([...selectedDates].map((date) => ({ date, time })));

  const generateRecurring = () => {
    if (!rangeStart || !rangeEnd || weekdays.size === 0) { flash("요일과 기간을 선택해 주세요."); return; }
    const start = parseLocal(rangeStart);
    const end = parseLocal(rangeEnd);
    const slots: { date: string; time: string }[] = [];
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      if (weekdays.has(day.getDay())) {
        slots.push({ date: ymd(day.getFullYear(), day.getMonth(), day.getDate()), time: recurTime });
      }
    }
    generate(slots);
  };

  const deleteSession = async (sessionId: string) => {
    const res = await fetch(`/api/admin/templates/sessions?sessionId=${sessionId}`, { method: "DELETE" });
    if (res.ok) loadSessions();
  };

  return (
    <div className="admin-root">
      <div className="admin-main">
        <header className="admin-top">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--text-tertiary)] mb-1">
              <ArrowLeft size={14} /> 상품 목록
            </Link>
            <h1 className="admin-top-title">{template?.title ?? "상품"} · 일정관리</h1>
            <p className="admin-top-sub">
              {template ? `${categoryLabel(template.category)} · ${template.region_slug} · ${template.age_group} · 정원 ${template.capacity}` : ""}
            </p>
          </div>
        </header>

        <div className="admin-wrap">
          {/* 판매 옵션 (성별·나이대 가격) */}
          <div className="admin-card" style={{ marginBottom: 20 }}>
            <div className="admin-card-head">
              <span className="admin-card-title flex items-center gap-1.5">
                <Tag size={16} /> 판매 옵션 (성별·나이대별 가격/정원)
              </span>
            </div>
            <div className="admin-card-pad">
              <form onSubmit={saveOption} className="flex flex-wrap items-end gap-2 mb-4">
                <input
                  className="admin-input"
                  style={{ width: 150 }}
                  placeholder="옵션명 (예: 남 2039)"
                  value={optionForm.label}
                  onChange={(e) => setOptionForm({ ...optionForm, label: e.target.value })}
                />
                <select
                  className="admin-select"
                  style={{ width: 90 }}
                  value={optionForm.gender}
                  onChange={(e) => setOptionForm({ ...optionForm, gender: e.target.value })}
                >
                  {GENDERS.map((g) => (
                    <option key={g.key} value={g.key}>{g.label}</option>
                  ))}
                </select>
                <input
                  className="admin-input"
                  style={{ width: 90 }}
                  placeholder="나이대"
                  value={optionForm.ageGroup}
                  onChange={(e) => setOptionForm({ ...optionForm, ageGroup: e.target.value })}
                />
                <input
                  className="admin-input"
                  style={{ width: 110 }}
                  type="number"
                  placeholder="가격"
                  value={optionForm.price}
                  onChange={(e) => setOptionForm({ ...optionForm, price: Number(e.target.value) })}
                />
                <input
                  className="admin-input"
                  style={{ width: 80 }}
                  type="number"
                  placeholder="정원"
                  value={optionForm.capacity}
                  onChange={(e) => setOptionForm({ ...optionForm, capacity: Number(e.target.value) })}
                />
                <button type="submit" className="admin-btn admin-btn-primary">
                  {editingOptionId ? <Pencil size={15} /> : <Plus size={15} />}
                  {editingOptionId ? "수정" : "추가"}
                </button>
                {editingOptionId && (
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => {
                      setEditingOptionId(null);
                      setOptionForm(emptyOption);
                    }}
                  >
                    취소
                  </button>
                )}
              </form>

              {options.length === 0 ? (
                <p className="tds-caption">
                  옵션이 없으면 상품 기본 가격으로 판매돼요. 성별·나이대로 가격을 다르게 하려면 옵션을 추가하세요.
                </p>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>옵션명</th>
                        <th>성별</th>
                        <th>나이대</th>
                        <th>가격</th>
                        <th>정원</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {options.map((option) => (
                        <tr key={option.id}>
                          <td className="font-semibold text-[var(--text-primary)]">{option.label}</td>
                          <td>{genderLabel(option.gender)}</td>
                          <td>{option.age_group || "-"}</td>
                          <td>{formatKRW(option.price)}</td>
                          <td>{option.capacity}</td>
                          <td>
                            <div className="flex gap-1.5 justify-end">
                              <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => editOption(option)}>
                                <Pencil size={14} />
                              </button>
                              <button className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" onClick={() => deleteOption(option.id)}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="admin-sched">
            {/* 달력 */}
            <div className="admin-card">
              <div className="admin-card-head">
                <span className="admin-card-title">날짜 선택</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => moveMonth(-1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-[14px] font-bold w-[88px] text-center">{year}년 {month + 1}월</span>
                  <button type="button" className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => moveMonth(1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
              <div className="admin-card-pad">
                <div className="cal-grid mb-1">
                  {DOW.map((label, index) => (
                    <div key={label} className="cal-dow" style={{ color: index === 0 ? "#FF6B6B" : index === 6 ? "#3182F6" : undefined }}>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="cal-grid">
                  {cells.map((day, index) => {
                    if (day === null) return <div key={`empty-${index}`} />;
                    const key = ymd(year, month, day);
                    const isSelected = selectedDates.has(key);
                    const hasSession = sessionDates.has(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleDate(key)}
                        className={`cal-cell ${hasSession ? "cal-cell-has" : ""} ${isSelected ? "cal-cell-selected" : ""}`}
                      >
                        {day}
                        {hasSession && <span className="cal-dot" />}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="admin-input" style={{ width: 130 }} />
                  <button type="button" onClick={generateSelected} className="admin-btn admin-btn-primary" style={{ flex: 1 }}>
                    <CalendarCheck size={16} /> 선택 {selectedDates.size}일 생성
                  </button>
                </div>
                <p className="tds-caption mt-2">점이 있는 날 = 이미 생성된 일정. 날짜를 눌러 선택 후 생성하세요.</p>
              </div>
            </div>

            {/* 우측: 정기 + 목록 */}
            <div className="flex flex-col gap-5">
              <div className="admin-card">
                <div className="admin-card-head">
                  <span className="admin-card-title flex items-center gap-1.5"><Repeat size={16} /> 정기 일정</span>
                </div>
                <div className="admin-card-pad">
                  <div className="flex gap-1.5 mb-3">
                    {DOW.map((label, index) => {
                      const active = weekdays.has(index);
                      return (
                        <button
                          key={label}
                          type="button"
                          onClick={() =>
                            setWeekdays((prev) => {
                              const next = new Set(prev);
                              if (next.has(index)) next.delete(index);
                              else next.add(index);
                              return next;
                            })
                          }
                          className={`w-9 h-9 rounded-full text-[13px] font-bold ${active ? "bg-[var(--accent-primary)] text-white" : "bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="admin-field-row">
                    <AdminDatePicker value={rangeStart} onChange={setRangeStart} placeholder="시작일" />
                    <AdminDatePicker value={rangeEnd} onChange={setRangeEnd} placeholder="종료일" />
                  </div>
                  <div className="flex items-center gap-2 mt-2.5">
                    <input type="time" value={recurTime} onChange={(e) => setRecurTime(e.target.value)} className="admin-input" style={{ width: 130 }} />
                    <button type="button" onClick={generateRecurring} className="admin-btn admin-btn-ghost" style={{ flex: 1 }}>
                      <Repeat size={16} /> 정기 생성
                    </button>
                  </div>
                  <p className="tds-caption mt-2">예: 화·목 + 기간 → 그 기간의 모든 화·목요일 일정 일괄 생성.</p>
                </div>
              </div>

              <div className="admin-card">
                <div className="admin-card-head">
                  <span className="admin-card-title">생성된 일정 {sessions.length}건</span>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <tbody>
                      {sessions.length === 0 && (
                        <tr><td><div className="admin-empty">아직 일정이 없어요.</div></td></tr>
                      )}
                      {sessions.map((session) => (
                        <tr key={session.id}>
                          <td className="font-semibold text-[var(--text-primary)]">{session.date} {session.time}</td>
                          <td>신청 {session.joined}/{session.capacity}</td>
                          <td>
                            <div className="flex justify-end">
                              <button className="admin-btn admin-btn-danger admin-btn-sm admin-btn-icon" onClick={() => deleteSession(session.id)}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)", background: "#16181d", color: "#fff", padding: "12px 20px", borderRadius: 999, fontSize: 14, fontWeight: 700, zIndex: 90, boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
