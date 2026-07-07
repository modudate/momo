-- ============================================================
-- 사이트 콘텐츠 (홈 배너 등) — key-value JSONB 저장
--  · 쓰기는 service_role 전용, 읽기는 서버 API 경유 (RLS 공개정책 없음)
-- ============================================================
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.site_content enable row level security;
