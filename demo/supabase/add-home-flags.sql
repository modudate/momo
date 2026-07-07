-- ============================================================
-- 홈 노출 플래그 (상품 → 홈 모임 카드) + 이미지 업로드 버킷
-- ============================================================

-- 상품에 홈 노출 설정
--  · home_section: null(노출 안함) | 'signature'(시그니처 모임) | 'premium'(인증 모임)
--  · home_badge  : 홈 카드의 검정 뱃지 문구 (예: 자연스러운 대화의 장)
--  · home_sort   : 섹션 내 정렬
alter table public.moim_templates add column if not exists home_section text;
alter table public.moim_templates add column if not exists home_badge text;
alter table public.moim_templates add column if not exists home_sort int not null default 0;

-- 이미지 업로드용 공개 버킷
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

-- 공개 읽기 (업로드는 service_role 키로만 → 정책 불필요)
drop policy if exists "images_public_read" on storage.objects;
create policy "images_public_read" on storage.objects
  for select using (bucket_id = 'images');
