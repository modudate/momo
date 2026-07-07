-- 상품 상세 페이지 (블록 에디터: text/image 블록 배열)
alter table public.moim_templates
  add column if not exists detail jsonb not null default '[]'::jsonb;
