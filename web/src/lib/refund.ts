// 취소·환불 규정 (상세페이지 표시 + PG 연동 후 환불 계산에 공용 사용)

export const REFUND_POLICY: string[] = [
  "모임 2일 전까지 취소 시 100% 환불됩니다.",
  "모임 전날·당일 취소 시 환불이 불가합니다.",
  "단, 신청 후 1시간 이내 취소 시에는 전날·당일이어도 100% 환불됩니다.",
];

const pad = (n: number) => String(n).padStart(2, "0");

// 취소 시점(ms)의 KST 달력 날짜(YYYY-MM-DD)
function kstDateString(ms: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

// 모임 날짜의 전날(YYYY-MM-DD)
function previousDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// 환불 비율(%) — 결제(PG) 연동 후 취소 처리에 사용
//  · 신청 후 1시간 이내 취소 → 100%
//  · 모임 전날·당일 취소 → 0% (환불 불가)
//  · 그 외(2일 전 이상) → 100%
export function computeRefundRate(opts: {
  appliedAtMs: number;
  cancelAtMs: number;
  meetingDate: string; // YYYY-MM-DD (KST)
}): 100 | 0 {
  const { appliedAtMs, cancelAtMs, meetingDate } = opts;

  // 신청 후 1시간 이내 취소는 무조건 100%
  if (cancelAtMs - appliedAtMs <= 60 * 60 * 1000) return 100;

  const cancelDay = kstDateString(cancelAtMs);
  if (cancelDay === meetingDate || cancelDay === previousDate(meetingDate)) {
    return 0;
  }
  return 100;
}
