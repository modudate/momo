-- ============================================================
-- 다인 주문 원자 생성 RPC — 정원 검증 + 삽입을 한 트랜잭션으로
--  · meetings 행 잠금(FOR UPDATE)으로 동시 주문 오버셀 방지
--  · 검증: 전체(실+가상) 정원, 옵션별(실구매) 정원
-- ============================================================
create or replace function public.create_group_order(
  p_meeting_id text,
  p_user_id    uuid,
  p_tickets    jsonb -- [{amount,option_id,option_label,gender,name,phone,birth_year}]
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
begin
  select * into m from public.meetings where id = p_meeting_id for update;
  if not found then raise exception 'meeting_not_found'; end if;

  n := jsonb_array_length(p_tickets);
  if n is null or n < 1 or n > 10 then raise exception 'bad_tickets'; end if;

  -- 전체 정원: 실구매(취소 제외) + 가상 + 이번 요청
  select count(*) into real_cnt
    from public.orders where meeting_id = p_meeting_id and status <> 'cancelled';
  shown := real_cnt + coalesce(m.virtual_male, 0) + coalesce(m.virtual_female, 0);
  if shown + n > m.capacity then raise exception 'sold_out'; end if;

  -- 옵션별 정원 (실구매 기준)
  for rec in
    select (value ->> 'option_id') as oid, count(*)::int as k
      from jsonb_array_elements(p_tickets)
     where value ->> 'option_id' is not null
     group by 1
  loop
    select capacity into opt_cap from public.template_options where id = rec.oid;
    if opt_cap is null then raise exception 'invalid_option'; end if;
    select count(*) into opt_cnt
      from public.orders
     where meeting_id = p_meeting_id and option_id = rec.oid and status <> 'cancelled';
    if opt_cnt + rec.k > opt_cap then raise exception 'sold_out'; end if;
  end loop;

  return query
  insert into public.orders
    (meeting_id, user_id, amount, status, buyer_name, buyer_phone, birth_year,
     option_id, option_label, gender, group_id)
  select p_meeting_id, p_user_id,
         (value ->> 'amount')::int, 'pending',
         value ->> 'name', value ->> 'phone', nullif(value ->> 'birth_year', '')::int,
         value ->> 'option_id', value ->> 'option_label', value ->> 'gender', gid
    from jsonb_array_elements(p_tickets)
  returning *;
end; $$;

revoke all on function public.create_group_order(text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_group_order(text, uuid, jsonb) to service_role;
