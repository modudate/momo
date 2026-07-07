-- ============================================================
-- 예약 관리 페이지 (2단계)
--  · profiles.birth_year  : 참석자 명단의 출생년도
--  · profiles.gender      : (선택) 회원 성별 — 명단 보조용
--  · orders.attended      : 현장 참석여부 체크인
--  · 회원가입 트리거가 birth_year / gender 도 함께 저장하도록 갱신
-- ============================================================

alter table public.profiles add column if not exists birth_year int;
alter table public.profiles add column if not exists gender text;

alter table public.orders
  add column if not exists attended boolean not null default false;

-- 가입 시 메타데이터에서 birth_year / gender 까지 프로필로 복사
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone, birth_year, gender)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'phone',
    nullif(new.raw_user_meta_data ->> 'birth_year', '')::int,
    new.raw_user_meta_data ->> 'gender'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
