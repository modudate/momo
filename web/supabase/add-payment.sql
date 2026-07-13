-- ============================================================
-- KCP 결제 연동
--  · 신청하면 10분간 자리를 잡아두고(expires_at), 그 안에 결제 안 하면 자동 반납
--  · 결제 완료 시 그룹(다인 신청) 전체를 한 번에 paid 처리
-- ============================================================

-- 자리 홀드 만료 시각 (null = 만료 없음 = 기존 신청 건)
alter table public.orders add column if not exists expires_at timestamptz;
create index if not exists orders_meeting_status_idx on public.orders (meeting_id, status);

-- 결제 안 하고 방치된 신청 → 자리 반납 (failed 처리)
create or replace function public.expire_stale_orders() returns void
language sql security definer
set search_path = public
as $$
  update public.orders
     set status = 'failed'
   where status = 'pending'
     and expires_at is not null
     and expires_at < now();
$$;

-- ============================================================
-- 다인 주문 생성 — 정원 검증 + 10분 홀드
--   유효 인원 = 결제완료 + (결제대기 중 아직 안 만료된 것) + 가상구매
-- ============================================================
create or replace function public.create_group_order(
  p_meeting_id text,
  p_user_id    uuid,
  p_tickets    jsonb
) returns setof public.orders
language plpgsql security definer
set search_path = public
as $$
declare
  m        public.meetings;
  n        int;
  real_cnt int;
  shown    int;
  gid      uuid := gen_random_uuid();
  rec      record;
  opt_cap  int;
  opt_cnt  int;
  hold     timestamptz := now() + interval '10 minutes';
begin
  -- 만료된 미결제 건 먼저 정리 (자리 반납)
  perform public.expire_stale_orders();

  select * into m from public.meetings where id = p_meeting_id for update;
  if not found then raise exception 'meeting_not_found'; end if;

  n := jsonb_array_length(p_tickets);
  if n is null or n < 1 or n > 10 then raise exception 'bad_tickets'; end if;

  -- 전체 정원: 유효 신청 + 가상 + 이번 요청
  select count(*) into real_cnt
    from public.orders
   where meeting_id = p_meeting_id
     and (status = 'paid'
          or (status = 'pending' and (expires_at is null or expires_at > now())));
  shown := real_cnt + coalesce(m.virtual_male, 0) + coalesce(m.virtual_female, 0);
  if shown + n > m.capacity then raise exception 'sold_out'; end if;

  -- 옵션 유효성 + (설정된 경우에만) 옵션별 정원
  for rec in
    select (value ->> 'option_id') as oid, count(*)::int as k
      from jsonb_array_elements(p_tickets)
     where value ->> 'option_id' is not null
     group by 1
  loop
    select capacity into opt_cap from public.template_options where id = rec.oid;
    if opt_cap is null then raise exception 'invalid_option'; end if;
    if opt_cap > 0 then
      select count(*) into opt_cnt
        from public.orders
       where meeting_id = p_meeting_id and option_id = rec.oid
         and (status = 'paid'
              or (status = 'pending' and (expires_at is null or expires_at > now())));
      if opt_cnt + rec.k > opt_cap then raise exception 'sold_out'; end if;
    end if;
  end loop;

  return query
  insert into public.orders
    (meeting_id, user_id, amount, status, buyer_name, buyer_phone, birth_year,
     option_id, option_label, gender, group_id, expires_at)
  select p_meeting_id, p_user_id,
         (value ->> 'amount')::int, 'pending',
         value ->> 'name', value ->> 'phone', nullif(value ->> 'birth_year', '')::int,
         value ->> 'option_id', value ->> 'option_label', value ->> 'gender', gid, hold
    from jsonb_array_elements(p_tickets)
  returning *;
end; $$;

revoke all on function public.create_group_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_group_order(text, uuid, jsonb) to service_role;

-- ============================================================
-- 결제 승인 확정 — 그룹 전체를 paid 로 (중복 승인 방지)
--   이미 paid 면 0건 반환 → 서버가 중복 승인으로 판단
-- ============================================================
create or replace function public.mark_group_paid(
  p_group_id uuid,
  p_tno      text
) returns setof public.orders
language plpgsql security definer
set search_path = public
as $$
begin
  return query
  update public.orders
     set status = 'paid',
         pg_tid = p_tno,
         paid_at = now(),
         expires_at = null
   where group_id = p_group_id
     and status = 'pending'
  returning *;
end; $$;

revoke all on function public.mark_group_paid(uuid, text) from public, anon, authenticated;
grant execute on function public.mark_group_paid(uuid, text) to service_role;

-- 취소/환불 기록
alter table public.orders add column if not exists refund_amount int;
alter table public.orders add column if not exists cancelled_at timestamptz;
