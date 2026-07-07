-- ============================================================
-- 블랙리스트 + 성비 임시마감(남/여) + 일정이동 지원
-- ============================================================

-- 일정(세션)별 성별 임시마감 (성비 조정용) — true 면 해당 성별 신청 차단
alter table public.meetings add column if not exists closed_male boolean not null default false;
alter table public.meetings add column if not exists closed_female boolean not null default false;

-- 블랙리스트 (이름·전화) — 신청자 전화번호와 대조해 명단에 표시(차단은 안 함)
create table if not exists public.blacklist (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  phone      text not null,
  phone_norm text generated always as (regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')) stored,
  memo       text,
  created_at timestamptz not null default now()
);
create index if not exists blacklist_phone_norm_idx on public.blacklist (phone_norm);

-- RLS: 공개 읽기 정책 없음 → 관리자 service_role 키로만 접근
alter table public.blacklist enable row level security;
