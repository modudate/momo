// 신청 마감 정책 — 시작 N분 전까지만 신청 가능 (한국시간 기준)
export const BOOKING_CUTOFF_MINUTES = 10;

// 모임 시작 시각(ms). date(YYYY-MM-DD) + time(HH:mm) 을 KST(+09:00)로 해석.
export function meetingStartMs(date: string, time: string): number {
  return new Date(`${date}T${time}:00+09:00`).getTime();
}

// 지금 신청 가능한지 (마감 N분 전 이전이면 true)
export function isBookingOpen(
  date: string,
  time: string,
  cutoffMinutes: number = BOOKING_CUTOFF_MINUTES,
  nowMs: number = Date.now(),
): boolean {
  return nowMs <= meetingStartMs(date, time) - cutoffMinutes * 60_000;
}
