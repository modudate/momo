-- 모임 상세페이지용 컬럼 추가
alter table public.meetings add column if not exists description text;
alter table public.meetings add column if not exists place text;
