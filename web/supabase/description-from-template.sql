-- ============================================================
-- 모임 소개 문구 = 예약 상품의 "상세 소개"를 따라가도록
--  · 기존에는 일정 생성 시 상품의 소개가 일정으로 복사돼서,
--    상품의 상세 소개를 수정해도 이미 만든 일정에는 반영되지 않았음.
--  · 상품에서 복사된 것과 똑같은 문구만 비워서(=덮어쓰기 없음),
--    앞으로는 상품의 상세 소개를 그대로 따라가게 한다.
--  · 일정별로 따로 적어둔 문구(상품과 다른 문구)는 그대로 둔다.
-- ============================================================
update public.meetings m
   set description = null
  from public.moim_templates t
 where m.template_id = t.id
   and m.description is not null
   and btrim(coalesce(m.description, '')) = btrim(coalesce(t.description, ''));
