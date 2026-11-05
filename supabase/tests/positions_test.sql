-- 직책 조회 권한·중복 생성 거부 테스트. 실행: npx supabase test db
begin;
select plan(2);

-- 유효한 기수와 직책을 먼저 만들어 FK 오류가 중복 검사를 가리지 않게 한다.
insert into public.terms (id, name, status)
values ('33333333-0000-0000-0000-000000000003', 'Issue #3 직책 테스트 기수', 'DRAFT');
insert into public.positions (term_id, name, sort_order)
values ('33333333-0000-0000-0000-000000000003', '테스트 직책', 1);

-- postgres로 검사하여 테이블 권한 오류보다 유일 제약을 검사한다.
select throws_ok(
  $$ insert into public.positions (term_id, name, sort_order)
     values ('33333333-0000-0000-0000-000000000003', '테스트 직책', 2) $$,
  '23505',
  null,
  '관리자(postgres)의 / 같은 기수에 같은 이름의 직책 생성이 / 거부된다'
);

set local role anon;
select throws_ok(
  $$ select * from public.positions $$,
  '42501',
  null,
  '로그인하지 않은 사용자(anon)의 / 직책 조회가 / 거부된다'
);

reset role;
select * from finish();
rollback;
