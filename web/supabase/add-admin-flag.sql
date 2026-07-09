-- 관리자 플래그 — 이메일 허용목록(ADMIN_EMAILS) 외에 DB로도 관리자 지정
alter table public.profiles add column if not exists is_admin boolean not null default false;
