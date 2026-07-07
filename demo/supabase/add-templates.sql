-- 모임 상품(템플릿) — 복제·정기일정 생성의 원본
create table if not exists public.moim_templates (
  id          text primary key,
  category    text not null default 'wine',   -- wine / coffee / popular / premium
  region_slug text not null references public.regions(slug) on delete cascade,
  age_group   text not null default 'all',    -- 예: 2039, 3045, all
  title       text not null,
  description text,
  place       text,
  price       int  not null default 0 check (price >= 0),
  capacity    int  not null default 16 check (capacity > 0),
  image       text,
  created_at  timestamptz not null default now()
);
create index if not exists moim_templates_region_idx on public.moim_templates (region_slug);

alter table public.moim_templates enable row level security;
drop policy if exists "templates_read" on public.moim_templates;
create policy "templates_read" on public.moim_templates for select using (true);

-- 세션(meetings)에 템플릿 연결
alter table public.meetings
  add column if not exists template_id text references public.moim_templates(id) on delete set null;
create index if not exists meetings_template_idx on public.meetings (template_id);
