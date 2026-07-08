-- ============================================================
-- 옵션별 정원 제거 → 정원은 상품(일정) 전체 정원만 적용
--  · template_options.capacity = 0 → 옵션별 정원 없음
--  · create_group_order: 옵션 정원은 0보다 클 때만 검증
--  · 기존 옵션은 전부 0으로 전환
-- ============================================================

alter table public.template_options alter column capacity set default 0;
update public.template_options set capacity = 0;

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
       where meeting_id = p_meeting_id and option_id = rec.oid and status <> 'cancelled';
      if opt_cnt + rec.k > opt_cap then raise exception 'sold_out'; end if;
    end if;
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
