-- 로그인·승인 명단·Membership 권한 허용/거부 테스트
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(18);

-- ---------------------------------------------------------------------
-- 준비 (postgres 역할)
-- A: 승인된 재무국 국원 / B: 승인 명단에 없는 학생 / D: 소속이 종료된 전 국원
-- ---------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'authenticated', 'authenticated', 'test.member.a@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'authenticated', 'authenticated', 'test.student.b@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('dddddddd-0000-0000-0000-00000000000d', 'authenticated', 'authenticated', 'test.former.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.approved_council_accounts (id, term_id, email, role, department_id)
select
  'aaaaaaaa-1111-0000-0000-00000000000a',
  '00000000-0000-0000-0000-000000000001',
  'test.member.a@hanyang.ac.kr',
  'MEMBER',
  d.id
from public.departments d
where d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '재무국';

-- D는 예전에 승인·활성화됐지만 지금은 소속이 종료됐다
insert into public.approved_council_accounts (id, term_id, email, role, department_id, activated_user_id, activated_at)
select
  'dddddddd-1111-0000-0000-00000000000d',
  '00000000-0000-0000-0000-000000000001',
  'test.former.d@hanyang.ac.kr',
  'MEMBER',
  d.id,
  'dddddddd-0000-0000-0000-00000000000d',
  now()
from public.departments d
where d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '홍보국';

insert into public.memberships (term_id, user_id, role, department_id, approved_account_id, is_active, left_at)
select a.term_id, a.activated_user_id, a.role, a.department_id, a.id, false, now()
from public.approved_council_accounts a
where a.id = 'dddddddd-1111-0000-0000-00000000000d';

-- ---------------------------------------------------------------------
-- 0. 가입 트리거: auth.users가 생기면 profiles도 생긴다
-- ---------------------------------------------------------------------
select is(
  (select count(*)::int from public.profiles where id in (
    'aaaaaaaa-0000-0000-0000-00000000000a',
    'bbbbbbbb-0000-0000-0000-00000000000b',
    'dddddddd-0000-0000-0000-00000000000d')),
  3,
  '학교 Google 계정이 가입하면 profiles가 만들어진다'
);

-- ---------------------------------------------------------------------
-- 1. 허용: 승인된 계정 A의 첫 로그인 활성화
-- ---------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

select results_eq(
  $$ select term_id, role from public.activate_membership() $$,
  $$ values ('00000000-0000-0000-0000-000000000001'::uuid, 'MEMBER'::public.member_role) $$,
  '승인된 계정 A는 첫 로그인 때 2026 기수 MEMBER로 활성화된다'
);

select is(
  (select count(*)::int from public.departments where term_id = '00000000-0000-0000-0000-000000000001'),
  4,
  '활성화된 A는 같은 기수의 부서 4개를 볼 수 있다'
);

-- ---------------------------------------------------------------------
-- 6. 멱등: 반복 활성화해도 중복 생성 없음
-- ---------------------------------------------------------------------
select is(
  (select count(*)::int from public.activate_membership()),
  1,
  'A가 다시 활성화를 호출해도 활성 소속은 하나다'
);

select is(
  (select count(*)::int from public.memberships where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a'),
  1,
  'A의 Membership 행은 반복 호출 뒤에도 하나뿐이다'
);

-- ---------------------------------------------------------------------
-- 3. 거부: 자기 역할 상승
-- ---------------------------------------------------------------------
select throws_ok(
  $$ update public.memberships set role = 'EXECUTIVE'
     where user_id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'A는 자기 Membership의 role을 EXECUTIVE로 바꿀 수 없다'
);

select throws_ok(
  $$ insert into public.approved_council_accounts (term_id, email, role)
     values ('00000000-0000-0000-0000-000000000001', 'test.member.a@hanyang.ac.kr', 'EXECUTIVE') $$,
  '42501',
  null,
  'A는 승인 명단에 자기 자신을 EXECUTIVE로 추가할 수 없다'
);

select throws_ok(
  $$ update public.profiles set email = 'someone.else@hanyang.ac.kr'
     where id = 'aaaaaaaa-0000-0000-0000-00000000000a' $$,
  '42501',
  null,
  'A는 자기 Profile의 이메일을 바꿀 수 없다 (display_name만 가능)'
);

select is_empty(
  $$ select * from public.approved_council_accounts $$,
  'MEMBER인 A는 승인 명단을 볼 수 없다'
);

-- ---------------------------------------------------------------------
-- 4. 거부: 다른 기수 접근
-- ---------------------------------------------------------------------
select is_empty(
  $$ select * from public.departments where term_id = '00000000-0000-0000-0000-000000000002' $$,
  'A는 소속되지 않은 2025 기수(CLOSED)의 부서를 볼 수 없다'
);

-- ---------------------------------------------------------------------
-- 2. 거부: 미승인 계정 B의 내부 조회
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}';

select is_empty(
  $$ select * from public.activate_membership() $$,
  '승인 명단에 없는 B는 로그인은 되지만 Membership이 생기지 않는다'
);

select is_empty(
  $$ select * from public.departments $$,
  '미승인 B는 부서를 볼 수 없다'
);

select is_empty(
  $$ select * from public.profiles where id <> 'bbbbbbbb-0000-0000-0000-00000000000b' $$,
  '미승인 B는 다른 사람의 Profile을 볼 수 없다'
);

-- ---------------------------------------------------------------------
-- 5. 거부: 종료된 소속 D의 접근
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"dddddddd-0000-0000-0000-00000000000d","role":"authenticated"}';

select is_empty(
  $$ select * from public.activate_membership() $$,
  '소속이 종료된 D는 다시 로그인해도 Membership이 되살아나지 않는다'
);

select is_empty(
  $$ select * from public.departments $$,
  '소속이 종료된 D는 부서를 볼 수 없다'
);

-- ---------------------------------------------------------------------
-- 로그인하지 않은 사용자
-- ---------------------------------------------------------------------
reset role;
set local role anon;

select throws_ok(
  $$ select * from public.activate_membership() $$,
  '42501',
  null,
  '로그인하지 않은 사용자는 활성화 함수를 호출할 수 없다'
);

select throws_ok(
  $$ select * from public.memberships $$,
  '42501',
  null,
  '로그인하지 않은 사용자는 memberships를 볼 수 없다'
);

-- ---------------------------------------------------------------------
-- 직접 쓰기 금지 확인 (로그인 사용자도)
-- ---------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$ insert into public.memberships (term_id, user_id, role)
     values ('00000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'EXECUTIVE') $$,
  '42501',
  null,
  'A는 memberships에 직접 INSERT할 수 없다'
);

select * from finish();
rollback;
