-- ============================================================
-- 후기 시스템 + 홈 카테고리 관리 + 모임 종료시간/강제숨김
--  (2026-07-09 협의 반영)
-- ============================================================

-- ---------- 1. 홈 카테고리(노출 섹션) — 관리자가 직접 추가·수정 ----------
create table if not exists public.home_sections (
  key        text primary key,               -- signature / premium / foreign ...
  title      text not null,                  -- 홈 섹션 제목
  card_label text not null default '',       -- 카드 위 주황 라벨 기본값
  sort       int  not null default 0,
  created_at timestamptz not null default now()
);

-- 기존 하드코딩 섹션을 그대로 옮겨 심기
insert into public.home_sections (key, title, card_label, sort) values
  ('signature', '🔥 모두의 모임을 대표하는 시그니처 모임', '시그니처', 1),
  ('premium',   '🔥 특별한 분들을 위한 프리미엄 모임',      '프리미엄', 2)
on conflict (key) do nothing;

-- 상품별 주황 라벨 (비우면 섹션 기본 라벨 사용)
alter table public.moim_templates add column if not exists home_label text;

-- 기존 동작 보존: 인기남녀 카테고리 상품은 라벨을 '인기남녀'로
update public.moim_templates
   set home_label = '인기남녀'
 where category = 'popular' and home_section is not null and home_label is null;

alter table public.home_sections enable row level security;
drop policy if exists "home_sections_read" on public.home_sections;
create policy "home_sections_read" on public.home_sections for select using (true);

-- ---------- 2. 모임 종료 시간 + 관리자 강제 숨김 ----------
--  · end_time : 'HH:mm' (null이면 미설정 → 기존처럼 시작시간 기준으로만 판단)
--  · hidden   : 관리자가 손님 화면에서 강제로 내린 모임
alter table public.meetings add column if not exists end_time text;
alter table public.meetings add column if not exists hidden boolean not null default false;

-- ---------- 3. 후기 ----------
--  · 예약(주문) 1건당 후기 1개 → order_id unique
--  · 작성/삭제는 서버(service_role)에서 권한 검증 후 수행
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  order_id   uuid not null unique references public.orders(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists reviews_created_idx on public.reviews (created_at desc);
create index if not exists reviews_user_idx on public.reviews (user_id);

alter table public.reviews enable row level security;
drop policy if exists "reviews_read" on public.reviews;
create policy "reviews_read" on public.reviews for select using (true);

-- ---------- 4. 후기 반응 (좋아요 / 싫어요) ----------
--  · 한 후기에 한 사람이 1회만 (pk로 강제)
create table if not exists public.review_reactions (
  review_id  uuid not null references public.reviews(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('up', 'down')),
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index if not exists review_reactions_review_idx on public.review_reactions (review_id);

alter table public.review_reactions enable row level security;
drop policy if exists "review_reactions_read" on public.review_reactions;
create policy "review_reactions_read" on public.review_reactions for select using (true);
