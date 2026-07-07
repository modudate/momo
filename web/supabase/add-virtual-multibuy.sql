-- ============================================================
-- 가상구매(성비 조절) + 다인 구매(티켓별 참가자)
-- ============================================================

-- 모임별 가상구매 인원 (손님에게 실구매와 합산되어 보임)
alter table public.meetings add column if not exists virtual_male   int not null default 0 check (virtual_male >= 0);
alter table public.meetings add column if not exists virtual_female int not null default 0 check (virtual_female >= 0);

-- 다인 구매: 같은 결제 묶음(group_id) + 티켓별 참가자 출생년도
alter table public.orders add column if not exists group_id uuid;
alter table public.orders add column if not exists birth_year int;
create index if not exists orders_group_idx on public.orders (group_id);
