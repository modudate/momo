-- 판매 옵션 (성별·나이대별 가격/정원) — 한 상품(템플릿) 안에 여러 옵션
create table if not exists public.template_options (
  id          text primary key,
  template_id text not null references public.moim_templates(id) on delete cascade,
  label       text not null,                 -- 예: 남 2039
  gender      text not null default 'any',   -- male / female / any
  age_group   text default '',
  price       int  not null default 0 check (price >= 0),
  capacity    int  not null default 8 check (capacity >= 0),
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists template_options_tpl_idx on public.template_options (template_id);

alter table public.template_options enable row level security;
drop policy if exists "template_options_read" on public.template_options;
create policy "template_options_read" on public.template_options for select using (true);

-- 주문에 옵션 정보 (성별 분리·옵션별 가격)
alter table public.orders add column if not exists option_id text;
alter table public.orders add column if not exists option_label text;
alter table public.orders add column if not exists gender text;
create index if not exists orders_meeting_option_idx on public.orders (meeting_id, option_id);
