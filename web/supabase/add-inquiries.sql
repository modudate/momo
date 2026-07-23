-- 1:1 문의 (고객 → 운영진, 운영진 답변)
--  · 회원이 제목/내용을 작성하고, 관리자가 답변을 남긴다.
--  · content/answer 는 일반 텍스트(줄바꿈 보존). HTML 저장 안 함(사용자 입력 XSS 방지).
create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  content     text not null,
  status      text not null default 'open',   -- 'open'(대기) | 'answered'(답변완료)
  answer      text,                            -- 관리자 답변
  answered_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists inquiries_user_idx on public.inquiries (user_id, created_at desc);
create index if not exists inquiries_status_idx on public.inquiries (status, created_at desc);

alter table public.inquiries enable row level security;
-- 정책 없음 = service_role(서버)만 접근. 모든 읽기/쓰기는 서버 API(getServerUser / isAdminAllowed)를 거친다.
