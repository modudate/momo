-- ============================================================
-- 회원 목록 조회 RPC (관리자) — auth.users + profiles
--  · security definer 로 auth.users 접근, service_role 만 실행 가능하게 잠금
-- ============================================================
create or replace function public.admin_member_list()
returns table (
  id         uuid,
  email      text,
  name       text,
  phone      text,
  birth_year int,
  gender     text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.email::text, p.name, p.phone, p.birth_year, p.gender, u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  order by u.created_at desc;
$$;

revoke all on function public.admin_member_list() from public, anon, authenticated;
grant execute on function public.admin_member_list() to service_role;
