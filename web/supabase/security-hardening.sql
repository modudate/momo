-- 출시 전 보안 잠금 (2026-07 감사 결과 반영)
--
-- [치명] 1. profiles_self 정책이 FOR ALL 이라 로그인 회원이 자기 행의 is_admin 을
--          true 로 바꿔 관리자로 승격할 수 있었다. (관리자 판정 = profiles.is_admin)
-- [치명] 2. 구버전 RPC mark_order_paid 가 anon 키로 호출 가능 → 결제 없이 paid 처리 가능.
-- [높음] 3. 구버전 RPC create_pending_order 가 anon 키로 호출 가능 → 사칭 주문 생성 가능.
-- 나머지는 정리 차원.

-- 1) profiles: 본인 "읽기"만 허용. 쓰기는 전부 서버(service_role) 경유.
--    (브라우저는 supabase.auth 만 쓰고 profiles 를 직접 만지는 코드가 없음을 확인함)
drop policy if exists profiles_self on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id);
-- 테이블 권한 차원에서도 쓰기 차단 (정책 실수에 대비한 이중 방어)
revoke insert, update, delete on public.profiles from anon, authenticated;

-- 2) 구버전 결제 RPC 제거 — 신규 흐름(create_group_order / mark_group_paid)이 대체했고
--    코드 어디서도 참조하지 않음을 확인함.
drop function if exists public.mark_order_paid(uuid, text);
drop function if exists public.create_pending_order(text, uuid, text, text);

-- 3) expire_stale_orders 는 서버 전용으로 잠금
revoke all on function public.expire_stale_orders() from public, anon, authenticated;
grant execute on function public.expire_stale_orders() to service_role;

-- 4) reviews / review_reactions 공개 읽기 제거.
--    화면은 전부 서버 API(/api/reviews — 이름 마스킹 포함)를 거치므로 직접 읽기가 필요 없고,
--    공개로 두면 user_id / order_id 열거가 가능하다.
drop policy if exists reviews_read on public.reviews;
drop policy if exists review_reactions_read on public.review_reactions;

-- 5) orders 도 이중 방어: 본인 읽기 정책은 유지하되 클라이언트 쓰기는 권한 차원에서 차단
revoke insert, update, delete on public.orders from anon, authenticated;
