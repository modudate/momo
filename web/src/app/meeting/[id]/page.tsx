"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, notFound } from "next/navigation";
import { Clock, MapPin, Check, CreditCard, Minus, Plus, X } from "lucide-react";
import TopNav from "@/components/TopNav";
import SiteFooter from "@/components/SiteFooter";
import { useUser } from "@/components/auth/useUser";
import { isBookingOpen } from "@/lib/booking";
import { REFUND_POLICY } from "@/lib/refund";
import { formatKRW } from "@/data/moim-data";
import { openPayment, isPaymentEnabled } from "@/lib/kcp/pay-window";

// 결제 연동 여부 (사이트코드가 있으면 결제 모드)
const PAYMENT_ON = isPaymentEnabled;

type MeetingOption = {
  id: string;
  label: string;
  gender: string;
  age_group: string;
  price: number;
  capacity: number;
  joined: number;
};

type DetailBlock =
  | { type: "text"; text: string }
  | { type: "image"; url: string }
  | { type: "html"; html: string };

type Counts = { capacity: number; total: number; male: number; female: number };

type MeetingDetail = {
  id: string;
  date: string;
  time: string;
  title: string;
  tag: string;
  price: number;
  capacity: number;
  joined: number;
  image: string;
  description?: string;
  place?: string;
  regionSlug: string;
  regionName: string;
  closed_male: boolean;
  closed_female: boolean;
  detail: DetailBlock[];
  counts: Counts;
  options: MeetingOption[];
};

type Attendee = { name: string; phone: string; birthYear: string; gender: string };

function genderLabel(gender: string) {
  return gender === "male" ? "남성" : gender === "female" ? "여성" : "공용";
}

function isGenderClosed(meeting: MeetingDetail, gender: string) {
  return (
    (gender === "male" && meeting.closed_male) ||
    (gender === "female" && meeting.closed_female)
  );
}

const MAX_TICKETS = 10;

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useUser();

  const [meeting, setMeeting] = useState<MeetingDetail | null | undefined>(undefined);
  const [qty, setQty] = useState<Record<string, number>>({}); // optionId(또는 "single") → 수량
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1); // 1=인원 선택, 2=참가자 정보
  const [includeSelf, setIncludeSelf] = useState(false); // 참가자 1 = 본인
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paying, setPaying] = useState(false); // 결제창 진행 중
  const [ordered, setOrdered] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/meetings/${id}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data: MeetingDetail | null) => {
        if (!active) return;
        setMeeting(data);
      })
      .catch(() => active && setMeeting(null));
    return () => {
      active = false;
    };
  }, [id]);

  // 모바일 결제 후 KCP → 서버 → 이 페이지로 돌아온다 (?pay=done|fail|cancel)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pay = params.get("pay");
    if (!pay) return;

    if (pay === "done") {
      setOrdered(true);
    } else if (pay === "cancel") {
      setErrorMessage("결제를 취소했어요. 다시 신청하실 수 있어요.");
    } else if (pay === "fail") {
      const code = params.get("code");
      setErrorMessage(
        code === "hold_expired"
          ? "자리 확보 시간이 지났어요. 다시 신청해 주세요."
          : "결제에 실패했어요. 다시 시도해 주세요.",
      );
    }
    // 새로고침해도 메시지가 다시 뜨지 않게 쿼리 제거
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  const hasOptions = (meeting?.options.length ?? 0) > 0;

  // 선택한 티켓들 (옵션 순서대로 펼침)
  const pickedTickets = useMemo(() => {
    if (!meeting) return [] as { optionId?: string; label: string; price: number }[];
    if (hasOptions) {
      return meeting.options.flatMap((option) =>
        Array.from({ length: qty[option.id] ?? 0 }, () => ({
          optionId: option.id,
          label: option.label,
          price: option.price,
        })),
      );
    }
    return Array.from({ length: qty["single"] ?? 0 }, () => ({
      optionId: undefined as string | undefined,
      label: "티켓",
      price: meeting.price,
    }));
  }, [meeting, qty, hasOptions]);

  const totalCount = pickedTickets.length;
  const totalPrice = pickedTickets.reduce((s, t) => s + t.price, 0);

  if (meeting === undefined) {
    return (
      <div className="app-main">
        <TopNav title="모임 상세" back />
        <div className="page-content py-20 text-center">
          <p className="tds-caption">불러오는 중…</p>
        </div>
      </div>
    );
  }
  if (meeting === null) return notFound();

  const counts = meeting.counts;
  const spotsLeft = counts.capacity - counts.total;
  const bookingOpen = isBookingOpen(meeting.date, meeting.time);
  const meetingClosed = spotsLeft <= 0 || !bookingOpen;

  const setCount = (key: string, delta: number, maxLeft: number) => {
    setQty((prev) => {
      const cur = prev[key] ?? 0;
      const totalOthers = totalCount - cur;
      let next = cur + delta;
      if (next < 0) next = 0;
      if (next > maxLeft) next = maxLeft;
      if (totalOthers + next > MAX_TICKETS) next = MAX_TICKETS - totalOthers;
      if (totalOthers + next > spotsLeft) next = Math.max(0, spotsLeft - totalOthers);
      return { ...prev, [key]: next };
    });
  };

  const openSheet = () => {
    if (currentUser === null) {
      router.push("/login");
      return;
    }
    setErrorMessage("");
    setStep(1);
    setSheetOpen(true);
  };

  // 1단계(인원) -> 2단계(참가자 정보)
  const goAttendees = () => {
    // 기존 입력값은 인덱스 기준으로 보존
    setAttendees((prev) =>
      pickedTickets.map((_, i) => prev[i] ?? { name: "", phone: "", birthYear: "", gender: "" }),
    );
    setErrorMessage("");
    setStep(2);
  };

  // 본인(회원) 정보 — 본인 포함 체크 시 참가자 1에 사용
  const selfMeta = (currentUser?.user_metadata ?? {}) as {
    name?: string;
    phone?: string;
    birth_year?: string;
    gender?: string;
  };
  const selfReady = Boolean(selfMeta.name && selfMeta.phone && selfMeta.birth_year);

  const submitOrder = async () => {
    // 참가자 정보 검증 (본인 포함 시 참가자 1은 회원정보 사용)
    for (let i = 0; i < attendees.length; i++) {
      if (includeSelf && i === 0) {
        if (!selfReady) {
          setErrorMessage("회원정보에 이름/전화번호/출생년도가 없어 본인 포함을 사용할 수 없어요.");
          return;
        }
        if (!pickedTickets[0]?.optionId && selfMeta.gender !== "male" && selfMeta.gender !== "female") {
          setErrorMessage("회원정보에 성별이 없어요. 본인 포함을 해제하고 직접 입력해 주세요.");
          return;
        }
        continue;
      }
      const a = attendees[i];
      if (!a.name.trim() || !a.phone.trim() || !a.birthYear.trim()) {
        setErrorMessage("모든 참가자의 이름·전화번호·출생년도를 입력해 주세요.");
        return;
      }
      if (!pickedTickets[i]?.optionId && a.gender !== "male" && a.gender !== "female") {
        setErrorMessage("모든 참가자의 성별을 선택해 주세요.");
        return;
      }
      const y = Number(a.birthYear);
      if (Number.isNaN(y) || y < 1940 || y > 2015) {
        setErrorMessage("출생년도를 확인해 주세요. (예: 1995)");
        return;
      }
    }
    setIsSubmitting(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          tickets: pickedTickets.map((t, i) => {
            if (includeSelf && i === 0) {
              return {
                optionId: t.optionId,
                name: (selfMeta.name ?? "").trim(),
                phone: (selfMeta.phone ?? "").trim(),
                birthYear: Number(selfMeta.birth_year),
                gender: t.optionId ? undefined : selfMeta.gender,
              };
            }
            return {
              optionId: t.optionId,
              name: attendees[i].name.trim(),
              phone: attendees[i].phone.trim(),
              birthYear: Number(attendees[i].birthYear),
              gender: t.optionId ? undefined : attendees[i].gender,
            };
          }),
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(
          body.error === "sold_out"
            ? "정원이 마감됐어요."
            : body.error === "gender_closed"
              ? "성비 조정으로 임시 마감된 옵션이에요."
              : body.error === "closed"
                ? "신청이 마감됐어요. (시작 임박)"
                : body.error === "attendee_required"
                  ? "참가자 정보를 모두 입력해 주세요."
                  : "신청에 실패했어요.",
        );
        return;
      }

      const order = (await response.json()) as {
        amount: number;
        orderName: string;
        payment:
          | { required: false }
          | { required: true; ordrNo: string; buyerName: string; buyerTel: string; holdMinutes: number };
      };

      // 결제 미연동 상태 → 예전처럼 신청 접수로 끝
      if (!order.payment.required) {
        setOrdered(true);
        setSheetOpen(false);
        return;
      }

      // 결제창 → 승인
      setSheetOpen(false);
      setPaying(true);
      const result = await openPayment({
        ordrNo: order.payment.ordrNo,
        amount: order.amount,
        goodName: order.orderName,
        buyerName: order.payment.buyerName,
        buyerTel: order.payment.buyerTel,
        buyerEmail: currentUser?.email ?? "",
      });
      setPaying(false);

      if (result.status === "paid") {
        setOrdered(true);
        return;
      }
      if (result.status === "cancelled") {
        setErrorMessage(
          `결제를 취소했어요. 자리는 ${order.payment.holdMinutes}분간 잡아뒀으니 다시 시도하실 수 있어요.`,
        );
      } else {
        setErrorMessage(result.message);
      }
      setSheetOpen(true);
    } catch {
      setErrorMessage("신청에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-main pb-28">
      <TopNav title={meeting.regionName} back />

      <div className="aspect-[16/10] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={meeting.image} alt={meeting.title} className="w-full h-full object-cover" />
      </div>

      <div className="page-content pt-5">
        <span className="tds-badge tds-badge-accent">{meeting.tag}</span>
        <h1 className="tds-title-lg mt-2">{meeting.title}</h1>

        <div className="flex flex-col gap-2 mt-4">
          <p className="tds-subtitle inline-flex items-center gap-2">
            <Clock size={16} className="text-[var(--text-tertiary)]" />
            {Number(meeting.date.slice(5, 7))}월 {Number(meeting.date.slice(8, 10))}일 · {meeting.time}
          </p>
          {meeting.place && (
            <p className="tds-subtitle inline-flex items-center gap-2">
              <MapPin size={16} className="text-[var(--text-tertiary)]" />
              {meeting.place}
            </p>
          )}
        </div>

        {/* 인원 현황 — 전체·현재·남·여 */}
        <div className="crowd">
          <div className="crowd-cell">
            <span className="crowd-num">{counts.capacity}</span>
            <span className="crowd-label">전체 인원</span>
          </div>
          <div className="crowd-cell">
            <span className="crowd-num">{counts.total}</span>
            <span className="crowd-label">현재 인원</span>
          </div>
          <div className="crowd-cell crowd-male">
            <span className="crowd-num">{counts.male}</span>
            <span className="crowd-label">남자 신청</span>
          </div>
          <div className="crowd-cell crowd-female">
            <span className="crowd-num">{counts.female}</span>
            <span className="crowd-label">여자 신청</span>
          </div>
        </div>
      </div>

      <div className="tds-divider mt-5" />

      {/* 모임 소개 — 예약 상품의 "상세 소개" (일정별로 덮어쓸 수 있음).
          에디터로 만드는 이미지 상세는 홈 노출 모임의 /moim/[id] 전용. */}
      <div className="page-content section-block">
        <h2 className="tds-title-md mb-2">모임 소개</h2>
        <p className="tds-subtitle whitespace-pre-line">
          {meeting.description || "상세 소개가 곧 등록됩니다."}
        </p>
      </div>

      {/* 취소·환불 규정 */}
      <div className="tds-divider" />
      <div className="page-content section-block">
        <h2 className="tds-title-md mb-2">취소·환불 규정</h2>
        <ul className="refund-list">
          {REFUND_POLICY.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <SiteFooter />

      {/* 하단 고정 신청 바 — 왼쪽 티켓 선택, 오른쪽 신청하기 */}
      <div className="buy-bar">
        <div className="flex-1">
          <p className="tds-caption">{totalCount > 0 ? `티켓 ${totalCount}매` : "티켓"}</p>
          <p className="text-[18px] font-extrabold leading-tight">{formatKRW(totalPrice)}</p>
        </div>
        {ordered ? (
          <span className="inline-flex items-center gap-1.5 px-5 h-[52px] rounded-[var(--radius-md)] bg-[var(--bg-surface)] text-[15px] font-bold text-[var(--accent-secondary)]">
            <Check size={18} /> {PAYMENT_ON ? "결제 완료" : "신청 접수됨"}
          </span>
        ) : (
          <button
            type="button"
            onClick={openSheet}
            disabled={meetingClosed}
            className="px-6 h-[52px] inline-flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent-primary)] text-white font-bold text-[15px] disabled:opacity-50"
          >
            <CreditCard size={18} />
            {meetingClosed
              ? "마감"
              : currentUser === null
                ? "로그인하고 신청"
                : "신청하기"}
          </button>
        )}
      </div>
      {errorMessage && !sheetOpen && (
        <p className="page-content pb-4 text-[13px] text-[#FF4D4F] text-center">{errorMessage}</p>
      )}

      {/* 결제창 진행 중 — 뒤에서 조작 못 하게 덮어둠 */}
      {paying && (
        <div className="pay-overlay">
          <div className="pay-overlay-box">
            <CreditCard size={22} />
            <p>결제창에서 결제를 진행해 주세요</p>
            <span>창을 닫으면 신청이 취소돼요</span>
          </div>
        </div>
      )}


      {/* 신청 시트 — 1단계: 인원 선택 / 2단계: 참가자 정보 */}
      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => { setSheetOpen(false); setErrorMessage(""); }}>
          <div className="sheet flex flex-col" style={{ maxHeight: "86vh" }} onClick={(ev) => ev.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="flex items-center justify-between">
              <p className="tds-title-md">{step === 1 ? "몇 명 신청하시나요?" : "참가자 정보 입력"}</p>
              <button type="button" className="top-nav-icon" aria-label="닫기" onClick={() => { setSheetOpen(false); setErrorMessage(""); }}>
                <X size={20} />
              </button>
            </div>

            {step === 1 ? (
              <>
                <div className="flex-1 overflow-y-auto mt-3 flex flex-col gap-2 pb-2">
                  {hasOptions ? (
                    meeting.options.map((option) => {
                      // 옵션 정원 0 = 옵션별 정원 없음 → 전체 잔여석만 적용
                      const optLeft = option.capacity > 0 ? option.capacity - option.joined : spotsLeft;
                      const gClosed = isGenderClosed(meeting, option.gender);
                      const optClosed = optLeft <= 0 || gClosed || meetingClosed;
                      const n = qty[option.id] ?? 0;
                      return (
                        <div key={option.id} className={`tk-row ${optClosed && n === 0 ? "is-off" : ""}`}>
                          <div className="tk-info">
                            <p className="tk-label">{option.label}</p>
                            <p className="tk-meta">
                              {genderLabel(option.gender)}
                              {option.age_group ? ` · ${option.age_group}` : ""} ·{" "}
                              {gClosed ? "성비 조정 마감" : optLeft <= 0 ? "마감" : formatKRW(option.price)}
                            </p>
                          </div>
                          <div className="tk-stepper">
                            <button type="button" onClick={() => setCount(option.id, -1, optLeft)} disabled={n === 0} aria-label="빼기">
                              <Minus size={15} />
                            </button>
                            <span className="tk-count">{n}</span>
                            <button type="button" onClick={() => setCount(option.id, 1, optLeft)} disabled={optClosed} aria-label="더하기">
                              <Plus size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className={`tk-row ${meetingClosed ? "is-off" : ""}`}>
                      <div className="tk-info">
                        <p className="tk-label">티켓</p>
                        <p className="tk-meta">{meetingClosed ? "마감" : formatKRW(meeting.price)}</p>
                      </div>
                      <div className="tk-stepper">
                        <button type="button" onClick={() => setCount("single", -1, spotsLeft)} disabled={(qty["single"] ?? 0) === 0} aria-label="빼기">
                          <Minus size={15} />
                        </button>
                        <span className="tk-count">{qty["single"] ?? 0}</span>
                        <button type="button" onClick={() => setCount("single", 1, spotsLeft)} disabled={meetingClosed} aria-label="더하기">
                          <Plus size={15} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="pt-2 pb-1">
                  <button type="button" className="tds-btn-primary" onClick={goAttendees} disabled={totalCount === 0}>
                    {totalCount > 0 ? `다음 · ${totalCount}매 (${formatKRW(totalPrice)})` : "인원을 선택해 주세요"}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* 본인 포함 체크 — 대신 예약이면 해제 */}
                <button
                  type="button"
                  className={`selfchk ${includeSelf ? "is-on" : ""}`}
                  onClick={() => setIncludeSelf((v) => !v)}
                >
                  <span className="selfchk-box">{includeSelf && <Check size={13} />}</span>
                  <span className="selfchk-text">
                    본인 포함 (참가자 1 = 내 정보)
                    <em>{selfReady ? `${selfMeta.name} · ${selfMeta.phone}` : "회원정보가 부족하면 직접 입력해 주세요"}</em>
                  </span>
                </button>

                <div className="flex-1 overflow-y-auto mt-2 flex flex-col gap-4 pb-2">
                  {pickedTickets.map((t, i) => {
                    if (includeSelf && i === 0) {
                      return (
                        <div key={i} className="att-box att-self">
                          <p className="att-title">
                            참가자 1 <span className="att-opt">{t.label}</span> <span className="att-me">본인</span>
                          </p>
                          <p className="att-self-info">
                            {selfMeta.name ?? "-"} · {selfMeta.phone ?? "-"} · {selfMeta.birth_year ?? "-"}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={i} className="att-box">
                        <p className="att-title">
                          참가자 {i + 1} <span className="att-opt">{t.label}</span>
                        </p>
                        {/* 1줄: 이름 + 출생년도 */}
                        <div className="att-row">
                          <input
                            className="auth-input att-name"
                            placeholder="이름"
                            value={attendees[i]?.name ?? ""}
                            onChange={(e) =>
                              setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, name: e.target.value } : a)))
                            }
                          />
                          <input
                            className="auth-input att-birth"
                            type="number"
                            inputMode="numeric"
                            placeholder="출생년도"
                            value={attendees[i]?.birthYear ?? ""}
                            onChange={(e) =>
                              setAttendees((prev) =>
                                prev.map((a, idx) => (idx === i ? { ...a, birthYear: e.target.value } : a)),
                              )
                            }
                          />
                        </div>
                        {/* 2줄: 전화번호 */}
                        <input
                          className="auth-input att-phone"
                          type="tel"
                          inputMode="tel"
                          placeholder="전화번호"
                          value={attendees[i]?.phone ?? ""}
                          onChange={(e) =>
                            setAttendees((prev) =>
                              prev.map((a, idx) =>
                                idx === i ? { ...a, phone: e.target.value.replace(/\D/g, "") } : a,
                              ),
                            )
                          }
                        />
                        {!t.optionId && (
                          <div className="att-gender">
                            <button
                              type="button"
                              className={attendees[i]?.gender === "male" ? "is-on male" : ""}
                              onClick={() =>
                                setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, gender: "male" } : a)))
                              }
                            >
                              남성
                            </button>
                            <button
                              type="button"
                              className={attendees[i]?.gender === "female" ? "is-on female" : ""}
                              onClick={() =>
                                setAttendees((prev) => prev.map((a, idx) => (idx === i ? { ...a, gender: "female" } : a)))
                              }
                            >
                              여성
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {errorMessage && (
                  <p className="text-[13px] text-[#FF4D4F] py-2 text-center">{errorMessage}</p>
                )}

                <div className="pt-2 pb-1 flex gap-2">
                  <button type="button" className="tds-btn-ghost" style={{ flex: 1 }} onClick={() => setStep(1)}>
                    이전
                  </button>
                  <button type="button" className="tds-btn-primary" style={{ flex: 2 }} onClick={submitOrder} disabled={isSubmitting}>
                    {isSubmitting
                      ? "처리 중…"
                      : `${formatKRW(totalPrice)} ${PAYMENT_ON ? "결제하기" : "신청하기"}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
