"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Download,
  X,
  TrendingUp,
  TrendingDown,
  Wallet,
  Ticket,
  Users,
  CreditCard,
  Ban,
  Copy,
} from "lucide-react";
import { regions, formatKRW } from "@/data/moim-data";
import { useBackdropClose } from "@/lib/useBackdropClose";

type SalesRow = {
  id: string;
  amount: number;
  status: string;
  gender: string | null;
  option_label: string | null;
  attended: boolean;
  created_at: string;
  meeting_id: string;
  meeting_title: string;
  meeting_date: string | null;
  meeting_time: string | null;
  region_slug: string | null;
  region_name: string;
  member_name: string | null;
  name: string | null;
  phone: string | null;
  birth_year: number | null;
  blacklisted: boolean;
};

type SeriesPoint = { key: string; label: string; revenue: number };
type Analytics = {
  today: string;
  cards: {
    today: { revenue: number; changePct: number | null };
    week: { revenue: number; changePct: number | null };
    month: { revenue: number; changePct: number | null };
    year: { revenue: number; label: string };
  };
  kpi: { revenue: number; orders: number; paid: number; pending: number; avgTicket: number };
  series: { daily: SeriesPoint[]; weekly: SeriesPoint[]; monthly: SeriesPoint[] };
  avg12: number;
  byRegion: { name: string; revenue: number; count: number }[];
  byGender: { gender: string; revenue: number; count: number }[];
};
type Period = "daily" | "weekly" | "monthly";

const statusLabel: Record<string, string> = {
  paid: "결제완료",
  pending: "결제대기",
  cancelled: "취소됨",
  failed: "실패",
};
const genderLabel = (g: string | null) =>
  g === "male" ? "남" : g === "female" ? "여" : g === "any" ? "공용" : "-";

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];
// "2026-06-30" + "19:50" → "2026-06-30(화) 오후 7시50분"
function formatSchedule(date: string | null, time: string | null) {
  if (!date) return "-";
  const [y, m, d] = date.split("-").map(Number);
  const dow = DOW_KR[new Date(y, m - 1, d).getDay()];
  let t = "";
  if (time) {
    const [hh, mm] = time.split(":").map(Number);
    const ampm = hh < 12 ? "오전" : "오후";
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    t = ` ${ampm} ${h12}시${mm ? `${mm}분` : ""}`;
  }
  return `${date}(${dow})${t}`;
}

const formatMan = (v: number) => {
  if (v === 0) return "0";
  if (v >= 10000) {
    const man = v / 10000;
    return `${man % 1 === 0 ? man : man.toFixed(1)}만`;
  }
  return v.toLocaleString();
};

function todayKST() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function SalesPanel({ flash }: { flash: (m: string) => void }) {
  const today = useMemo(() => todayKST(), []);
  const [view, setView] = useState<"analytics" | "list">("analytics");

  // 매출 분석
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [anLoading, setAnLoading] = useState(true);

  // 판매 내역
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [q, setQ] = useState("");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [gender, setGender] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [detail, setDetail] = useState<SalesRow | null>(null);
  const detailBackdrop = useBackdropClose(() => setDetail(null));

  const loadAnalytics = useCallback(async () => {
    setAnLoading(true);
    const res = await fetch("/api/admin/sales/analytics");
    if (res.ok) setAnalytics(await res.json());
    setAnLoading(false);
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    const params = new URLSearchParams({ q, region, status, gender, from, to });
    const res = await fetch(`/api/admin/sales?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { orders: SalesRow[] };
      setRows(data.orders);
    } else {
      setRows([]);
    }
    setListLoading(false);
  }, [q, region, status, gender, from, to]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const t = setTimeout(loadList, 250); // q 입력 디바운스
    return () => clearTimeout(t);
  }, [loadList]);

  const cancelOrder = async (id: string) => {
    if (!window.confirm("이 주문을 강제 취소할까요?")) return;
    const res = await fetch("/api/admin/orders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      flash("취소했어요.");
      setDetail(null);
      loadList();
      loadAnalytics();
    } else {
      flash("취소에 실패했어요.");
    }
  };

  const exportCsv = () => {
    if (
      !window.confirm(
        "개인정보(전화번호·출생년도·이름)가 포함된 파일이에요. 안전하게 보관·관리해 주세요. 내보낼까요?",
      )
    )
      return;
    const head = [
      "주문ID", "모임", "지점", "행사일", "회원명", "이름", "전화번호",
      "출생년도", "옵션", "성별", "금액", "상태", "참석여부", "신청시각",
    ];
    const cell = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [
        r.id, r.meeting_title, r.region_name, r.meeting_date ?? "",
        r.member_name ?? "", r.name ?? "", r.phone ?? "", r.birth_year ?? "",
        r.option_label ?? "", genderLabel(r.gender), r.amount, statusLabel[r.status] ?? r.status,
        r.attended ? "참석" : "", new Date(r.created_at).toLocaleString("ko-KR"),
      ]
        .map(cell)
        .join(","),
    );
    const csv = "﻿" + [head.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `판매내역_${today}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); // 다운로드 시작 후 해제
  };

  const resetFilters = () => {
    setQ("");
    setRegion("all");
    setStatus("all");
    setGender("all");
    setFrom("");
    setTo("");
  };

  const copyPhone = async (phone: string | null) => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      flash(`전화번호 복사: ${phone}`);
    } catch {
      flash("복사에 실패했어요.");
    }
  };

  return (
    <div>
      {/* 세그먼트 */}
      <div className="sales-seg">
        <button data-active={view === "analytics"} onClick={() => setView("analytics")}>
          매출 분석
        </button>
        <button data-active={view === "list"} onClick={() => setView("list")}>
          판매 내역
        </button>
      </div>

      {view === "analytics" ? (
        anLoading || !analytics ? (
          <div className="admin-card">
            <div className="admin-empty">매출 데이터를 불러오는 중…</div>
          </div>
        ) : (
          <Analytics data={analytics} />
        )
      ) : (
        <>
          {/* 필터 바 */}
          <div className="sales-filters">
            <div className="sales-search">
              <Search size={16} />
              <input
                className="sales-search-input"
                placeholder="이름·전화·주문ID·모임 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {/* 지점·상태·성별 — 한 줄 */}
            <div className="sales-filter-row sales-filter-selects">
              <select className="admin-select" value={region} onChange={(e) => setRegion(e.target.value)}>
                <option value="all">전체 지점</option>
                {regions.map((r) => (
                  <option key={r.slug} value={r.slug}>{r.name}</option>
                ))}
              </select>
              <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="all">전체 상태</option>
                <option value="paid">결제완료</option>
                <option value="pending">결제대기</option>
                <option value="cancelled">취소됨</option>
                <option value="failed">실패</option>
              </select>
              <select className="admin-select" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="all">전체 성별</option>
                <option value="male">남</option>
                <option value="female">여</option>
              </select>
            </div>

            {/* 기간 + 동작 */}
            <div className="sales-filter-row">
              <input type="date" className="admin-input sales-fdate" value={from} onChange={(e) => setFrom(e.target.value)} title="행사일 시작" />
              <span className="sales-tilde">~</span>
              <input type="date" className="admin-input sales-fdate" value={to} onChange={(e) => setTo(e.target.value)} title="행사일 끝" />
              <button className="admin-btn admin-btn-ghost admin-btn-sm" onClick={resetFilters}>초기화</button>
              <button className="admin-btn admin-btn-primary admin-btn-sm" onClick={exportCsv} disabled={rows.length === 0}>
                <Download size={15} /> CSV
              </button>
            </div>
          </div>

          <div className="admin-card">
            <div className="sales-count">
              총 <b>{rows.length.toLocaleString()}</b>건
              {!listLoading && rows.length > 0 && (
                <span> · 합계 {formatKRW(rows.reduce((s, r) => s + (r.status === "cancelled" ? 0 : r.amount), 0))} (취소 제외)</span>
              )}
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>상태</th>
                    <th>구매일시</th>
                    <th>신청한 모임일정</th>
                    <th>신청한 모임지점</th>
                    <th>성별</th>
                    <th>닉네임</th>
                    <th>신청자이름</th>
                    <th>전화번호</th>
                    <th>금액</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading ? (
                    <tr><td colSpan={10}><div className="admin-empty">불러오는 중…</div></td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={10}><div className="admin-empty">조건에 맞는 판매가 없어요.</div></td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="sales-row" onClick={() => setDetail(r)}>
                        <td><span className={`admin-badge admin-badge-${r.status}`}>{statusLabel[r.status] ?? r.status}</span></td>
                        <td>{r.created_at.slice(0, 10)}</td>
                        <td>{formatSchedule(r.meeting_date, r.meeting_time)}</td>
                        <td className="font-semibold text-[var(--text-primary)]">
                          [{r.region_name}] {r.meeting_title}
                          {r.option_label && <span className="res-opt-badge" style={{ marginLeft: 6 }}>{r.option_label}</span>}
                        </td>
                        <td>{genderLabel(r.gender)}</td>
                        <td>{r.member_name ?? "-"}</td>
                        <td>
                          {r.blacklisted && (
                            <span className="res-black" title="블랙리스트 일치">
                              <Ban size={11} /> 블랙
                            </span>
                          )}
                          {r.name ?? "-"}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {r.phone ? (
                            <button className="sales-phone" onClick={() => copyPhone(r.phone)} title="전화번호 복사">
                              {r.phone} <Copy size={12} />
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="font-semibold">{formatKRW(r.amount)}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {r.status !== "cancelled" && (
                            <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => cancelOrder(r.id)}>
                              결제취소
                            </button>
                          )}
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

      {/* 주문 상세 모달 */}
      {detail && (
        <div className="admin-modal-back" {...detailBackdrop}>
          <div className="admin-modal" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-head">
              <span className="admin-modal-title">주문 상세</span>
              <button className="admin-btn admin-btn-ghost admin-btn-sm admin-btn-icon" onClick={() => setDetail(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="admin-modal-body">
              <DetailRow label="상태" value={<span className={`admin-badge admin-badge-${detail.status}`}>{statusLabel[detail.status] ?? detail.status}</span>} />
              <DetailRow label="주문ID" value={<code style={{ fontSize: 12 }}>{detail.id}</code>} />
              <DetailRow label="모임" value={detail.meeting_title} />
              <DetailRow label="지점 · 행사일" value={`${detail.region_name} · ${detail.meeting_date ?? "-"}`} />
              <DetailRow label="옵션 · 성별" value={detail.option_label ? `${detail.option_label} (${genderLabel(detail.gender)})` : "단일가"} />
              <DetailRow label="금액" value={<b>{formatKRW(detail.amount)}</b>} />
              <div className="sales-detail-div" />
              <DetailRow label="회원명" value={detail.member_name ?? "-"} />
              <DetailRow
                label="이름"
                value={
                  <span>
                    {detail.blacklisted && (
                      <span className="res-black" title="블랙리스트 일치">
                        <Ban size={11} /> 블랙
                      </span>
                    )}
                    {detail.name ?? "-"}
                  </span>
                }
              />
              <DetailRow
                label="전화번호"
                value={
                  detail.phone ? (
                    <button className="sales-phone" onClick={() => copyPhone(detail.phone)} title="복사">
                      {detail.phone} <Copy size={12} />
                    </button>
                  ) : (
                    "-"
                  )
                }
              />
              <DetailRow label="출생년도" value={detail.birth_year ?? "-"} />
              <DetailRow label="참석여부" value={detail.attended ? "참석" : "미체크"} />
              <DetailRow label="신청시각" value={new Date(detail.created_at).toLocaleString("ko-KR")} />
            </div>
            {detail.status !== "cancelled" && (
              <div className="admin-modal-foot">
                <button className="admin-btn admin-btn-danger" style={{ flex: 1 }} onClick={() => cancelOrder(detail.id)}>
                  주문 강제취소
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="sales-detail-row">
      <span className="sales-detail-label">{label}</span>
      <span className="sales-detail-value">{value}</span>
    </div>
  );
}

/* ---------- 매출 분석 ---------- */
function Analytics({ data }: { data: Analytics }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const series = data.series[period];
  const maxRev = Math.max(1, ...series.map((p) => p.revenue));
  const regionTotal = data.byRegion.reduce((s, r) => s + r.revenue, 0) || 1;
  const genderTotal = data.byGender.reduce((s, g) => s + g.revenue, 0) || 1;

  const periodTitle =
    period === "daily" ? "일별 (최근 30일)" : period === "weekly" ? "주별 (최근 12주)" : "월별 (최근 12개월)";

  return (
    <div className="sales-analytics">
      {/* 비교 카드: 오늘 / 이번 주 / 이번 달 / 연도 */}
      <div className="cmp-grid">
        <CmpCard label="오늘" value={data.cards.today.revenue} pct={data.cards.today.changePct} vs="어제 대비" />
        <CmpCard label="이번 주" value={data.cards.week.revenue} pct={data.cards.week.changePct} vs="지난주 대비" />
        <CmpCard label="이번 달" value={data.cards.month.revenue} pct={data.cards.month.changePct} vs="지난달 대비" />
        <CmpCard label={data.cards.year.label} value={data.cards.year.revenue} pct={null} vs="" />
      </div>

      {/* 기간별 매출 */}
      <div className="admin-card sales-chart-card">
        <div className="admin-card-head">
          <span className="admin-card-title">기간별 매출 · {periodTitle}</span>
          <div className="sales-seg" style={{ marginBottom: 0 }}>
            <button data-active={period === "daily"} onClick={() => setPeriod("daily")}>일별</button>
            <button data-active={period === "weekly"} onClick={() => setPeriod("weekly")}>주별</button>
            <button data-active={period === "monthly"} onClick={() => setPeriod("monthly")}>월별</button>
          </div>
        </div>
        <div className={`bchart ${period === "daily" ? "bchart-daily" : ""}`}>
          {series.map((p, i) => {
            const isLast = i === series.length - 1;
            const showLabel = period !== "daily" || i % 5 === 4 || isLast;
            return (
              <div className="bchart-col" key={p.key} title={`${p.key} · ${formatKRW(p.revenue)}`}>
                {period !== "daily" && (
                  <div className="bchart-val">{p.revenue ? formatMan(p.revenue) : ""}</div>
                )}
                <div className="bchart-track">
                  <div
                    className={`bchart-bar ${isLast ? "is-cur" : ""} ${p.revenue ? "" : "is-zero"}`}
                    style={{ height: `${(p.revenue / maxRev) * 100}%` }}
                  />
                </div>
                <div className={`bchart-label ${period === "daily" ? "bchart-label-day" : ""}`}>
                  {showLabel ? p.label : ""}
                </div>
              </div>
            );
          })}
        </div>
        <p className="avg12-note">직전 12개월 매출 평균 <b>{formatKRW(data.avg12)}</b></p>
      </div>

      {/* 요약 KPI */}
      <div className="sales-kpi">
        <KpiCard icon={<Wallet size={18} />} label="총 매출 (예상)" value={formatKRW(data.kpi.revenue)} />
        <KpiCard icon={<Ticket size={18} />} label="신청 건수" value={`${data.kpi.orders.toLocaleString()}건`} />
        <KpiCard icon={<CreditCard size={18} />} label="결제완료 / 대기" value={`${data.kpi.paid} / ${data.kpi.pending}`} />
        <KpiCard icon={<Users size={18} />} label="평균 객단가" value={formatKRW(data.kpi.avgTicket)} />
      </div>

      <div className="sales-breakdowns">
        {/* 지점별 */}
        <div className="admin-card sales-chart-card">
          <div className="admin-card-head">
            <span className="admin-card-title">지점별 매출 비중</span>
          </div>
          <div className="hbars">
            {data.byRegion.length === 0 && <div className="admin-empty" style={{ padding: 24 }}>데이터 없음</div>}
            {data.byRegion.map((r) => (
              <div className="hbar-row" key={r.name}>
                <div className="hbar-label">{r.name}</div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: `${(r.revenue / regionTotal) * 100}%` }} />
                </div>
                <div className="hbar-val">{formatKRW(r.revenue)}<span className="hbar-pct"> {Math.round((r.revenue / regionTotal) * 100)}%</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* 성별 */}
        <div className="admin-card sales-chart-card">
          <div className="admin-card-head">
            <span className="admin-card-title">성별 매출 비중</span>
          </div>
          <div className="hbars">
            {data.byGender.length === 0 && <div className="admin-empty" style={{ padding: 24 }}>데이터 없음</div>}
            {data.byGender.map((g) => (
              <div className="hbar-row" key={g.gender}>
                <div className="hbar-label">{genderLabel(g.gender)}{g.gender === "unknown" ? "(미지정)" : ""}</div>
                <div className="hbar-track">
                  <div
                    className="hbar-fill"
                    style={{
                      width: `${(g.revenue / genderTotal) * 100}%`,
                      background: g.gender === "male" ? "#3182f6" : g.gender === "female" ? "#e5484d" : "#868e96",
                    }}
                  />
                </div>
                <div className="hbar-val">{formatKRW(g.revenue)}<span className="hbar-pct"> {Math.round((g.revenue / genderTotal) * 100)}%</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CmpCard({ label, value, pct, vs }: { label: string; value: number; pct: number | null; vs: string }) {
  return (
    <div className="cmp-card">
      <span className="cmp-label">{label}</span>
      <span className="cmp-value">{value.toLocaleString("ko-KR")}원</span>
      {vs && (
        <span className={`cmp-pct ${pct === null ? "" : pct < 0 ? "down" : "up"}`}>
          {vs} {pct === null ? "—" : `${pct > 0 ? "+" : ""}${pct}%`}
        </span>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  return (
    <div className="sales-kpi-card">
      <div className="sales-kpi-icon">{icon}</div>
      <div className="sales-kpi-label">{label}</div>
      <div className={`sales-kpi-value ${tone ? `sales-kpi-${tone}` : ""}`}>{value}</div>
    </div>
  );
}
