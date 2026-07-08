"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, CalendarDays, X, Check } from "lucide-react";

// ============================================================
// 관리자 공용 커스텀 컨트롤 — 네이티브 select/date의 팝업까지 디자인 통일
// ============================================================

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);
  return ref;
}

// ---------- 커스텀 드롭다운 ----------
export function AdminSelect({
  value,
  onChange,
  options,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));
  const current = options.find((o) => o.value === value);

  return (
    <div className="asel" style={width ? { width } : undefined} ref={ref}>
      <button type="button" className={`asel-btn ${open ? "is-open" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span className="asel-label">{current?.label ?? "-"}</span>
        <ChevronDown size={15} className={`asel-chev ${open ? "is-open" : ""}`} />
      </button>
      {open && (
        <div className="asel-pop">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              className={`asel-opt ${o.value === value ? "is-sel" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
              {o.value === value && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 커스텀 날짜 피커 ----------
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

export function AdminDatePicker({
  value,
  onChange,
  placeholder = "날짜",
  width,
}: {
  value: string; // "" 또는 YYYY-MM-DD
  onChange: (v: string) => void;
  placeholder?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutsideClose(() => setOpen(false));

  const base = value || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const [year, setYear] = useState(() => Number(base.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(base.slice(5, 7))); // 1-12

  const openPicker = () => {
    if (!open && value) {
      setYear(Number(value.slice(0, 4)));
      setMonth(Number(value.slice(5, 7)));
    }
    setOpen((v) => !v);
  };

  const move = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="adate" style={width ? { width } : undefined} ref={ref}>
      <button type="button" className={`asel-btn ${open ? "is-open" : ""}`} onClick={openPicker}>
        <CalendarDays size={14} className="adate-ico" />
        <span className={`asel-label ${value ? "" : "is-empty"}`}>{value || placeholder}</span>
        {value && (
          <span
            className="adate-clear"
            role="button"
            aria-label="지우기"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <X size={13} />
          </span>
        )}
      </button>
      {open && (
        <div className="asel-pop adate-pop">
          <div className="adate-head">
            <button type="button" onClick={() => move(-1)} aria-label="이전 달">
              <ChevronLeft size={16} />
            </button>
            <span>
              {year}년 {month}월
            </span>
            <button type="button" onClick={() => move(1)} aria-label="다음 달">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="adate-grid adate-dow">
            {DOW.map((d, i) => (
              <span key={d} className={i === 0 ? "sun" : i === 6 ? "sat" : ""}>
                {d}
              </span>
            ))}
          </div>
          <div className="adate-grid">
            {cells.map((d, i) => {
              if (d === null) return <span key={`e-${i}`} />;
              const key = `${year}-${pad(month)}-${pad(d)}`;
              const sel = key === value;
              return (
                <button
                  key={key}
                  type="button"
                  className={`adate-day ${sel ? "is-sel" : ""}`}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                >
                  {d}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
