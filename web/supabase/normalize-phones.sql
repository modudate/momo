-- 전화번호 하이픈/공백 제거 (표시·검색 일관성: 01012345678 형태)
update public.profiles  set phone = regexp_replace(phone, '\D', '', 'g') where phone is not null and phone ~ '\D';
update public.orders    set buyer_phone = regexp_replace(buyer_phone, '\D', '', 'g') where buyer_phone is not null and buyer_phone ~ '\D';
update public.blacklist set phone = regexp_replace(phone, '\D', '', 'g') where phone ~ '\D';
