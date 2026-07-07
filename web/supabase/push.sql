-- ============================================================
-- 웹 푸시 구독 저장 테이블
-- Supabase SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- 서버(service_role 키)만 접근 → RLS 켜고 정책 없음(기본 차단, service_role 은 우회)
alter table public.push_subscriptions enable row level security;
