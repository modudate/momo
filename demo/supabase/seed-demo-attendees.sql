-- ============================================================
-- 데모용 가짜 회원 + 신청(주문) 시드 — 예약관리 명단 확인용
--  · 멱등: 매번 SEED 데이터 정리 후 다시 삽입
--  · 정리: email like '%@moim.test' (회원/프로필 cascade) + orders.pg_tid='SEED'
-- ============================================================

-- 0) 기존 SEED 데이터 정리
delete from public.orders where pg_tid = 'SEED';
delete from auth.users where email like '%@moim.test'; -- profiles 는 on delete cascade

-- 1) 오늘(2026-06-29) 데모 일정 1건 — "오늘의 일정" 카드 확인용
insert into public.meetings (id, region_slug, date, time, title, tag, price, capacity, joined, image)
values ('demo-today', 'hongdae', '2026-06-29', '19:30', '[데모] 오늘의 홍대 와인', '정기모임', 30000, 16, 0,
        'https://picsum.photos/seed/demo-today/800/600')
on conflict (id) do update set date = excluded.date, title = excluded.title;

-- 2) 가짜 회원 14명 (auth.users 삽입 → 트리거가 profiles 자동 생성)
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       v.email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('name', v.name, 'phone', v.phone, 'birth_year', v.birth_year, 'gender', v.gender),
       now(), now()
from (values
  ('m1@moim.test', '김민준', '010-2001-0001', '1994', 'male'),
  ('m2@moim.test', '이서준', '010-2001-0002', '1990', 'male'),
  ('m3@moim.test', '박도윤', '010-2001-0003', '1997', 'male'),
  ('m4@moim.test', '최주원', '010-2001-0004', '1988', 'male'),
  ('m5@moim.test', '정시우', '010-2001-0005', '2001', 'male'),
  ('m6@moim.test', '강하준', '010-2001-0006', '1993', 'male'),
  ('m7@moim.test', '윤지호', '010-2001-0007', '1996', 'male'),
  ('f1@moim.test', '김서연', '010-3001-0001', '1995', 'female'),
  ('f2@moim.test', '이지우', '010-3001-0002', '1999', 'female'),
  ('f3@moim.test', '박하윤', '010-3001-0003', '1992', 'female'),
  ('f4@moim.test', '최서아', '010-3001-0004', '2000', 'female'),
  ('f5@moim.test', '정수아', '010-3001-0005', '1991', 'female'),
  ('f6@moim.test', '한지유', '010-3001-0006', '1998', 'female'),
  ('f7@moim.test', '오예린', '010-3001-0007', '1996', 'female')
) as v(email, name, phone, birth_year, gender);

-- 3) 신청(주문) 삽입 — 성별/옵션/가격/결제상태/참석여부 다양
with seed(email, meeting_id, amount, status, option_label, gender, attended) as (
  values
    -- 06-15 홍대 "123" (붐비는 일정: 남5 / 여6)
    ('m1@moim.test', 's-313b3da4-5', 39000, 'paid',    '남 2030대', 'male',   true),
    ('m2@moim.test', 's-313b3da4-5', 45000, 'paid',    '남 3040대', 'male',   true),
    ('m3@moim.test', 's-313b3da4-5', 39000, 'pending', '남 2030대', 'male',   false),
    ('m4@moim.test', 's-313b3da4-5', 45000, 'paid',    '남 3040대', 'male',   false),
    ('m5@moim.test', 's-313b3da4-5', 39000, 'pending', '남 2030대', 'male',   false),
    ('f1@moim.test', 's-313b3da4-5', 25000, 'paid',    '여 2030대', 'female', true),
    ('f2@moim.test', 's-313b3da4-5', 25000, 'paid',    '여 2030대', 'female', true),
    ('f3@moim.test', 's-313b3da4-5', 29000, 'pending', '여 3040대', 'female', false),
    ('f4@moim.test', 's-313b3da4-5', 25000, 'paid',    '여 2030대', 'female', false),
    ('f5@moim.test', 's-313b3da4-5', 29000, 'paid',    '여 3040대', 'female', true),
    ('f6@moim.test', 's-313b3da4-5', 25000, 'pending', '여 2030대', 'female', false),
    -- 06-17 홍대 "123"
    ('m6@moim.test', 's-0e192d3a-a', 39000, 'paid',    '남 2030대', 'male',   true),
    ('m7@moim.test', 's-0e192d3a-a', 39000, 'pending', '남 2030대', 'male',   false),
    ('f7@moim.test', 's-0e192d3a-a', 25000, 'paid',    '여 2030대', 'female', true),
    -- 06-29 오늘 데모 일정
    ('m1@moim.test', 'demo-today',   39000, 'paid',    '남 2030대', 'male',   false),
    ('m3@moim.test', 'demo-today',   39000, 'paid',    '남 2030대', 'male',   false),
    ('f1@moim.test', 'demo-today',   25000, 'paid',    '여 2030대', 'female', false),
    ('f3@moim.test', 'demo-today',   25000, 'paid',    '여 2030대', 'female', false)
)
insert into public.orders
  (id, user_id, meeting_id, amount, status, buyer_name, buyer_phone,
   option_label, gender, attended, pg_tid, created_at)
select gen_random_uuid(), u.id, s.meeting_id, s.amount, s.status::order_status,
       p.name, p.phone, s.option_label, s.gender, s.attended, 'SEED', now()
from seed s
join auth.users u on u.email = s.email
join public.profiles p on p.id = u.id;
