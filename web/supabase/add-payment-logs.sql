-- 결제 진단 로그 — KCP 가 실제로 보낸 값과 승인 결과를 남긴다.
-- (결제가 실패했을 때 원인을 눈으로 확인하기 위한 용도)
create table if not exists public.payment_logs (
  id         bigserial primary key,
  kind       text not null,           -- 'ret_url' | 'approve_req' | 'approve_res' | 'error'
  ordr_no    text,
  payload    jsonb,
  created_at timestamptz not null default now()
);
create index if not exists payment_logs_created_idx on public.payment_logs (created_at desc);

alter table public.payment_logs enable row level security;
-- 서버(service_role)만 접근. 공개 정책 없음.
