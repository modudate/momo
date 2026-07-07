-- ============================================================
-- 모두의 모임 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 붙여넣고 Run 하세요.
-- ============================================================

-- ---------- 지역 ----------
create table if not exists public.regions (
  slug       text primary key,
  name       text not null,
  full_name  text not null,
  area       text not null,
  accent     text not null default '#FF8A3D',
  sort       int  not null default 0
);

-- ---------- 모임(일정) ----------
create table if not exists public.meetings (
  id          text primary key,
  region_slug text not null references public.regions(slug) on delete cascade,
  date        date not null,
  time        text not null,
  title       text not null,
  tag         text not null default '정기모임',
  price       int  not null check (price >= 0),
  capacity    int  not null check (capacity > 0),
  joined      int  not null default 0 check (joined >= 0),
  image       text,
  created_at  timestamptz not null default now()
);
create index if not exists meetings_region_date_idx on public.meetings (region_slug, date);

-- ---------- 회원 프로필 (auth.users 1:1) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text,
  phone      text,
  created_at timestamptz not null default now()
);

-- ---------- 주문(티켓 결제) ----------
create type order_status as enum ('pending', 'paid', 'cancelled', 'failed');

create table if not exists public.orders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  meeting_id  text not null references public.meetings(id),
  amount      int  not null check (amount >= 0),   -- 서버가 계산한 금액(위변조 방지 기준값)
  status      order_status not null default 'pending',
  buyer_name  text,
  buyer_phone text,
  pg_tid      text,                                -- KCP 거래번호(tno)
  created_at  timestamptz not null default now(),
  paid_at     timestamptz
);
create index if not exists orders_user_idx on public.orders (user_id, created_at desc);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.regions  enable row level security;
alter table public.meetings enable row level security;
alter table public.profiles enable row level security;
alter table public.orders   enable row level security;

-- 지역/모임: 누구나 읽기
drop policy if exists "regions_read"  on public.regions;
create policy "regions_read"  on public.regions  for select using (true);
drop policy if exists "meetings_read" on public.meetings;
create policy "meetings_read" on public.meetings for select using (true);

-- 프로필: 본인 것만 읽기/수정
drop policy if exists "profiles_self" on public.profiles;
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- 주문: 본인 주문만 조회 (생성/수정은 서버=service_role 키로만 → RLS 우회)
drop policy if exists "orders_self_read" on public.orders;
create policy "orders_self_read" on public.orders
  for select using (auth.uid() = user_id);

-- ============================================================
-- 정원 체크하며 주문 생성 (원자적) — 서버에서 호출
-- ============================================================
create or replace function public.create_pending_order(
  p_meeting_id text,
  p_user_id    uuid,
  p_name       text,
  p_phone      text
) returns public.orders
language plpgsql security definer as $$
declare
  m public.meetings;
  o public.orders;
begin
  select * into m from public.meetings where id = p_meeting_id for update;
  if not found then raise exception 'meeting_not_found'; end if;
  if m.joined >= m.capacity then raise exception 'sold_out'; end if;

  insert into public.orders (user_id, meeting_id, amount, buyer_name, buyer_phone)
  values (p_user_id, p_meeting_id, m.price, p_name, p_phone)
  returning * into o;
  return o;
end; $$;

-- 결제 승인 확정 (서버에서 KCP 승인 성공 후 호출) — 정원 +1, 상태 paid
create or replace function public.mark_order_paid(
  p_order_id uuid,
  p_pg_tid   text
) returns public.orders
language plpgsql security definer as $$
declare o public.orders;
begin
  update public.orders set status='paid', pg_tid=p_pg_tid, paid_at=now()
    where id=p_order_id and status='pending' returning * into o;
  if not found then raise exception 'order_not_pending'; end if;
  update public.meetings set joined = joined + 1 where id = o.meeting_id;
  return o;
end; $$;
