// 주문 상태 규칙 (정원·명단 계산의 단일 기준)
//
//  paid      : 결제완료 → 항상 인원에 포함
//  pending   : 결제대기 → 자리를 잡아둔 상태.
//              expires_at 이 지나면 자리를 반납한 것으로 보고 제외.
//              (expires_at 이 null 이면 결제 도입 전 신청 건 → 계속 포함)
//  cancelled : 취소 → 제외
//  failed    : 결제 실패/시간초과 → 제외
//
// ⚠️ status !== 'cancelled' 로만 거르면 failed·만료건이 정원을 잡아먹으니 반드시 이 함수를 쓸 것.

export const SEAT_HOLD_MINUTES = 10;

export type OrderLike = {
  status: string;
  expires_at?: string | null;
};

// 이 주문이 지금 자리를 차지하고 있는가
export function holdsSeat(o: OrderLike, nowMs: number = Date.now()): boolean {
  if (o.status === "paid") return true;
  if (o.status !== "pending") return false; // cancelled / failed
  if (!o.expires_at) return true; // 만료 개념이 없는 예전 신청 건
  return new Date(o.expires_at).getTime() > nowMs;
}

// DB 조회용 — 최소한 이 상태들만 가져오면 됨 (나머지는 어차피 제외)
export const SEAT_STATUSES = ["paid", "pending"] as const;
