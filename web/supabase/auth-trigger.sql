-- ============================================================
-- 회원가입 시 프로필 자동 생성 트리거
-- (이메일 확인 ON 이어도 세션 없이 안전하게 프로필이 만들어짐)
-- Supabase SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
