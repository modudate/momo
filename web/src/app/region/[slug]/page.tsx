"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Users,
  CalendarDays,
  MapPin,
  X,
} from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { isBookingOpen } from "@/lib/booking";
import { formatKRW, type Region, type MoimEvent } from "@/data/moim-data";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// 마감임박 기준 — 정원의 88% 이상
const CLOSING_SOON_RATIO = 0.88;

// 지점별 네이버지도 검색명
const MAP_PLACE: Record<string, string> = {
  gangnam: "모두의모임 선릉점",
  hongdae: "모두의모임 홍대점",
  suwon: "모두의모임 수원점",
};

function ymd(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// KST 오늘 (YYYY-MM-DD)
function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type StripDay = { key: string; day: number; dow: number; month: number };

// 오늘부터 30일 날짜 목록
function buildStrip(todayStr: string): StripDay[] {
  const [y, m, d] = todayStr.split("-").map(Number);
  const base = new Date(y, m - 1, d);
  return Array.from({ length: 30 }, (_, i) => {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    return {
      key: ymd(dt.getFullYear(), dt.getMonth(), dt.getDate()),
      day: dt.getDate(),
      dow: dt.getDay(),
      month: dt.getMonth() + 1,
    };
  });
}

export default function RegionPage() {
  const { slug } = useParams<{ slug: string }>();

  const today = useMemo(() => todayKST(), []);
  const strip = useMemo(() => buildStrip(today), [today]);

  const [region, setRegion] = useState<Region | null | undefined>(undefined); // undefined=로딩
  const [year, setYear] = useState(() => Number(today.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(today.slice(5, 7)) - 1); // 0-based
  const [selected, setSelected] = useState<string>(today);
  const [calOpen, setCalOpen] = useState(false);
  const [holidays, setHolidays] = useState<Record<string, string>>({}); // "YYYY-MM-DD" → 이름

  // 공휴일 로드 (올해 + 내년)
  useEffect(() => {
    let active = true;
    const y = Number(today.slice(0, 4));
    Promise.all(
      [y, y + 1].map((yy) =>
        fetch(`/api/holidays?year=${yy}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    ).then((results) => {
      if (!active) return;
      const merged: Record<string, string> = {};
      results.forEach((r) => r?.holidays && Object.assign(merged, r.holidays));
      setHolidays(merged);
    });
    return () => {
      active = false;
    };
  }, [today]);

  useEffect(() => {
    let active = true;
    fetch(`/api/regions/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Region | null) => {
        if (!active) return;
        setRegion(data);
      })
      .catch(() => active && setRegion(null));
    return () => {
      active = false;
    };
  }, [slug]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, MoimEvent[]>();
    region?.events.forEach((e) => {
      const arr = map.get(e.date) ?? [];
      arr.push(e);
      map.set(e.date, arr);
    });
    return map;
  }, [region]);

  if (region === undefined) {
    return (
      <div className="app-main">
        <TopNav title="모임 일정" back />
        <div className="page-content py-20 text-center">
          <p className="tds-caption">불러오는 중…</p>
        </div>
      </div>
    );
  }
  if (region === null) return notFound();

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const moveMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  // 달력에서 날짜 선택 → 선택하고 닫기
  const pickFromCalendar = (key: string) => {
    setSelected(key);
    setCalOpen(false);
  };

  const dayEvents = eventsByDate.get(selected) ?? [];

  return (
    <div className="app-main pb-10">
      <TopNav title={region.fullName} back />

      <div className="page-content pt-4 flex items-end justify-between">
        <div>
          <a
            href={`https://map.naver.com/p/search/${encodeURIComponent(MAP_PLACE[region.slug] ?? `모두의모임 ${region.name}점`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="region-map-link"
          >
            <MapPin size={13} /> &quot;{MAP_PLACE[region.slug] ?? `모두의모임 ${region.name}점`}&quot; 장소(클릭)
          </a>
          <h2 className="tds-title-lg mt-0.5">
            일정을 한눈에!
            <br />
            바로 신청하세요!
          </h2>
        </div>
        <button type="button" className="dstrip-calbtn" onClick={() => setCalOpen(true)}>
          <CalendarDays size={15} /> 캘린더로 보기
        </button>
      </div>

      {/* 오늘부터 30일 — 가로 날짜 스트립 */}
      <section className="dstrip">
        {strip.map((s, i) => {
          const isSel = selected === s.key;
          const has = eventsByDate.has(s.key);
          const showMonth = i === 0 || s.day === 1;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelected(s.key)}
              className={`dstrip-item ${isSel ? "is-sel" : ""}`}
            >
              <span className="dstrip-month">{showMonth ? `${s.month}월` : " "}</span>
              <span
                className="dstrip-day"
                style={
                  isSel
                    ? undefined
                    : {
                        color:
                          holidays[s.key] || s.dow === 0
                            ? "#e5484d"
                            : s.dow === 6
                              ? "#3182f6"
                              : undefined,
                      }
                }
              >
                {s.day}
              </span>
              <span
                className="dstrip-dow"
                style={isSel ? undefined : holidays[s.key] ? { color: "#e5484d" } : undefined}
                title={holidays[s.key] ?? undefined}
              >
                {holidays[s.key] ? "휴일" : DOW[s.dow]}
              </span>
              <span className={`dstrip-dot ${has ? "on" : ""}`} />
            </button>
          );
        })}
      </section>

      {/* 캘린더 시트 */}
      {calOpen && (
        <div className="sheet-backdrop" onClick={() => setCalOpen(false)}>
          <div className="sheet" onClick={(ev) => ev.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                className="top-nav-icon"
                aria-label="이전 달"
                onClick={() => moveMonth(-1)}
              >
                <ChevronLeft size={20} />
              </button>
              <span className="text-[16px] font-bold">
                {year}년 {month + 1}월
              </span>
              <div className="flex items-center">
                <button
                  type="button"
                  className="top-nav-icon"
                  aria-label="다음 달"
                  onClick={() => moveMonth(1)}
                >
                  <ChevronRight size={20} />
                </button>
                <button
                  type="button"
                  className="top-nav-icon"
                  aria-label="닫기"
                  onClick={() => setCalOpen(false)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="cal-grid mb-1">
              {DOW.map((d, i) => (
                <div
                  key={d}
                  className="cal-dow"
                  style={{ color: i === 0 ? "#FF6B6B" : i === 6 ? "#3182F6" : undefined }}
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="cal-grid">
              {cells.map((d, i) => {
                if (d === null) return <div key={`e-${i}`} />;
                const key = ymd(year, month, d);
                const has = eventsByDate.has(key);
                const isSel = selected === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickFromCalendar(key)}
                    title={holidays[key] ?? undefined}
                    className={`cal-cell ${has ? "cal-cell-has" : ""} ${
                      isSel ? "cal-cell-selected" : ""
                    }`}
                    style={!isSel && holidays[key] ? { color: "#e5484d" } : undefined}
                  >
                    {d}
                    {has && <span className="cal-dot" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 선택한 날짜의 모임 목록 */}
      <section className="page-content pt-5 pb-2">
        <h3 className="tds-title-md mb-3">
          {selected
            ? `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8, 10))}일 모임`
            : "날짜를 선택하세요"}
        </h3>

        {selected && dayEvents.length === 0 && (
          <p className="tds-caption py-6 text-center">이 날은 예정된 모임이 없어요.</p>
        )}

        <div className="flex flex-col gap-3">
          {dayEvents.map((e) => {
            const open = isBookingOpen(e.date, e.time);
            const full = e.capacity - e.joined <= 0; // 정원 마감 (사라지지 않고 "전원 마감" 표기)
            const closed = full || !open;
            // 정원의 88% 이상 차면 "마감임박"
            const ratio = e.capacity > 0 ? e.joined / e.capacity : 0;
            const almostFull = !full && ratio >= CLOSING_SOON_RATIO;
            const priceFrom = e.priceFrom ?? e.price;
            return (
              <article key={e.id} className={`evt-card ${closed ? "is-closed" : ""}`}>
                <Link href={`/meeting/${e.id}`} className="evt-top">
                  {/* 시간 — 카드 왼쪽 */}
                  <div className="evt-time">
                    <b>{e.time}</b>
                    {e.endTime && <span>~{e.endTime}</span>}
                  </div>

                  <div className="evt-info">
                    <p className="evt-title">
                      {e.title}
                      {full ? (
                        <span className="evt-closed-chip">전원 마감</span>
                      ) : !open ? (
                        <span className="evt-closed-chip">마감</span>
                      ) : almostFull ? (
                        <span className="evt-soon-chip">마감임박</span>
                      ) : null}
                    </p>

                    {/* 회색 소개 문구 한 줄 (관리자에서 수정) */}
                    {e.description && <p className="evt-desc">{e.description}</p>}

                    {/* 정원 채움 바 */}
                    <div className="evt-bar" aria-hidden>
                      <i
                        className={almostFull || full ? "is-hot" : ""}
                        style={{ width: `${Math.min(100, Math.round(ratio * 100))}%` }}
                      />
                    </div>

                    <p className="evt-meta">
                      <Users size={13} />
                      <span className="evt-mtxt">
                        <b className="evt-male">남 {e.male ?? 0}</b> · <b className="evt-female">여 {e.female ?? 0}</b> · {e.joined}/{e.capacity}명
                      </span>
                    </p>
                    <p className="evt-meta">
                      <b className="evt-price">
                        {formatKRW(priceFrom)}
                        {e.priceVaries && "~"}
                      </b>
                    </p>
                  </div>
                </Link>
                {!closed && (
                  <Link href={`/meeting/${e.id}`} className="evt-apply-side">
                    신청하기
                  </Link>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
