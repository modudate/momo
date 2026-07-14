import type { SupabaseClient } from "@supabase/supabase-js";

// 기한 지난 결제대기(pending) 주문을 실패 처리한다.
//
// 왜 필요한가:
//   결제창을 띄우면 주문이 pending 으로 생기고 10분간 자리를 잡아둔다.
//   손님이 결제를 끝내지 않으면 기한이 지나 자리는 자동으로 반납되지만(holdsSeat),
//   status 는 pending 그대로 남는다.
//   → 관리자 화면에 "결제대기" 로 영원히 남아 보인다.
//
//   DB 의 expire_stale_orders() 는 create_group_order 안에서만 돌기 때문에,
//   새 신청이 없으면 정리가 안 된다. 관리자가 목록을 열 때도 한 번 정리해준다.
export async function expireStaleOrders(admin: SupabaseClient): Promise<void> {
  try {
    await admin.rpc("expire_stale_orders");
  } catch {
    // 정리 실패가 조회를 막으면 안 된다
  }
}
