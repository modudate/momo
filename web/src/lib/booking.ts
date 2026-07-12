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

// 모임이 끝났는지 — 종료 시간(HH:mm)이 설정된 경우에만 판단.
// 종료 시간이 시작 시간보다 이르면 자정을 넘긴 것으로 보고 다음날로 계산 (예: 21:00~01:00)
export function isMeetingEnded(
  date: string,
  time: string,
  endTime: string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!endTime) return false;
  let endMs = meetingStartMs(date, endTime);
  if (endMs <= meetingStartMs(date, time)) endMs += 24 * 60 * 60_000;
  return nowMs > endMs;
}

// 손님 화면에 이 모임을 노출할지 — 관리자 강제 숨김 / 종료 시간 경과면 숨김
export function isMeetingVisible(
  m: { date: string; time: string; endTime?: string | null; hidden?: boolean },
  nowMs: number = Date.now(),
): boolean {
  if (m.hidden) return false;
  return !isMeetingEnded(m.date, m.time, m.endTime, nowMs);
}
