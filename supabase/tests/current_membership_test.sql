-- private.current_membership()과 이를 쓰는 권한 함수의 허용/거부 테스트
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(8);

-- ---------------------------------------------------------------------
-- 준비 (postgres 역할)
-- E: 2026 회장단이자 2027(DRAFT) 회장단 / R: 2026 재무국 국장, 2025(CLOSED) 소속도 활성으로 남아 있음
-- M: 2027(DRAFT) 국원 / X: 2026 소속이 종료된 전 국원
-- ---------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('eeeeeeee-0000-0000-0000-00000000000e', 'authenticated', 'authenticated', 'test.exec.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('cccccccc-0000-0000-0000-00000000000c', 'authenticated', 'authenticated', 'test.director.r@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('99999999-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'test.draft.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('88888888-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'test.former.x@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.terms (id, name, status)
values ('00000000-0000-0000-0000-000000000003', '2027 테스트 학생회', 'DRAFT');

insert into public.departments (term_id, name, sort_order)
values ('00000000-0000-0000-0000-000000000003', '사무국', 1);

insert into public.memberships (term_id, user_id, role, department_id, is_active, left_at)
values
  ('00000000-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-00000000000e', 'EXECUTIVE', null, true, null),
  ('00000000-0000-0000-0000-000000000003', 'eeeeeeee-0000-0000-0000-00000000000e', 'EXECUTIVE', null, true, null),
  ('00000000-0000-0000-0000-000000000001', 'cccccccc-0000-0000-0000-00000000000c', 'DIRECTOR',
    (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'), true, null),
  ('00000000-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-00000000000c', 'MEMBER',
    (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000002' and name = '사무국'), true, null),
  ('00000000-0000-0000-0000-000000000003', '99999999-0000-0000-0000-000000000009', 'MEMBER',
    (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000003' and name = '사무국'), true, null),
  ('00000000-0000-0000-0000-000000000001', '88888888-0000-0000-0000-000000000008', 'MEMBER',
    (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '홍보국'), false, now());

set local role authenticated;

-- ---------------------------------------------------------------------
-- 허용: 회장단 E
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"eeeeeeee-0000-0000-0000-00000000000e","role":"authenticated"}';

select results_eq(
  $$ select role, department_id from private.current_membership('00000000-0000-0000-0000-000000000001') $$,
  $$ values ('EXECUTIVE'::public.member_role, null::uuid) $$,
  '회장단 E는 2026 기수에서 부서 없는 EXECUTIVE 소속으로 확인된다'
);

select ok(
  private.is_executive('00000000-0000-0000-0000-000000000001'),
  '회장단 E는 is_executive가 참이다'
);

select results_eq(
  $$ select role from private.current_membership('00000000-0000-0000-0000-000000000003') $$,
  $$ values ('EXECUTIVE'::public.member_role) $$,
  '회장단 E는 준비 중(DRAFT)인 2027 기수에도 접근할 수 있다'
);

-- ---------------------------------------------------------------------
-- 허용·거부: 국장 R
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}';

select is(
  private.member_role('00000000-0000-0000-0000-000000000001'),
  'DIRECTOR'::public.member_role,
  '국장 R의 2026 기수 Role은 DIRECTOR다'
);

select ok(
  private.member_department('00000000-0000-0000-0000-000000000001')
    = (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  '국장 R의 2026 기수 부서는 재무국이다'
);

select is_empty(
  $$ select * from private.current_membership('00000000-0000-0000-0000-000000000002') $$,
  '국장 R의 종료된(CLOSED) 2025 기수 소속은 활성 행이 남아 있어도 거부된다'
);

-- ---------------------------------------------------------------------
-- 거부: DRAFT 기수 국원 M, 소속이 종료된 X
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"99999999-0000-0000-0000-000000000009","role":"authenticated"}';

select is_empty(
  $$ select * from private.current_membership('00000000-0000-0000-0000-000000000003') $$,
  '국원 M은 준비 중(DRAFT)인 2027 기수에 접근할 수 없다'
);

set local request.jwt.claims = '{"sub":"88888888-0000-0000-0000-000000000008","role":"authenticated"}';

select is_empty(
  $$ select * from private.current_membership('00000000-0000-0000-0000-000000000001') $$,
  '소속이 종료된 X는 2026 기수 소속으로 확인되지 않는다'
);

select * from finish();
rollback;
