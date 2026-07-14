-- 클라이언트 키(anon / authenticated)의 쓰기 권한 전면 회수
--
-- 왜: Supabase 기본 grant 로 public 스키마 전 테이블에 anon/authenticated 가
--     INSERT/UPDATE/DELETE/TRUNCATE 권한을 갖고 있었다.
--     RLS(정책 없음)가 INSERT/UPDATE/DELETE 는 막지만 **TRUNCATE 는 RLS 를 우회한다.**
--     이 앱의 모든 쓰기는 서버(service_role)를 거치므로 클라이언트 쓰기 권한은 필요 없다.
--
-- SELECT 는 남긴다 — RLS 정책이 행 단위로 걸러준다
--   (regions / meetings / moim_templates / template_options / home_sections = 공개 읽기,
--    profiles / orders = 본인 행만, 나머지는 정책 없음 = 접근 불가)

revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public
  from anon, authenticated;

-- 앞으로 만들어지는 테이블에도 같은 기본값 적용 (실수 방지)
alter default privileges in schema public
  revoke insert, update, delete, truncate, references, trigger
  on tables from anon, authenticated;

-- 서버(service_role)는 그대로 전권 유지
grant all on all tables in schema public to service_role;
