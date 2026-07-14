-- 결제 진단 로그에 평문으로 남은 개인정보 제거 (1회성 정리)
--   초기 로그 코드가 buyr_mail / buyr_tel2 / card_mask_no 등을 가리지 않고 저장했다.
--   이후 코드는 저장 전에 마스킹하므로, 기존 행만 정리하면 된다.
update public.payment_logs
set payload = (payload
    - 'buyr_name' - 'buyr_mail' - 'buyr_tel1' - 'buyr_tel2'
    - 'card_mask_no' - 'shop_user_id')
  || case
       when payload ? 'raw' then jsonb_build_object('raw',
         (payload->'raw')
           - 'buyr_name' - 'buyr_mail' - 'buyr_tel1' - 'buyr_tel2'
           - 'card_mask_no' - 'shop_user_id' - 'card_no')
       else '{}'::jsonb
     end
where payload ?| array['buyr_name','buyr_mail','buyr_tel1','buyr_tel2','card_mask_no','shop_user_id']
   or (payload ? 'raw' and (payload->'raw') ?| array['buyr_name','buyr_mail','buyr_tel1','buyr_tel2','card_mask_no','shop_user_id','card_no']);
