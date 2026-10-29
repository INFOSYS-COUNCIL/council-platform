-- 구성원 관리 함수(승인 명단·소속·부서·직책)와 학번 열람 범위의 허용/거부 테스트
-- 실행: npx supabase test db
-- 모든 계정과 학번은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(23);

-- ---------------------------------------------------------------------
-- 준비 (postgres 역할), 2026 테스트 학생회
-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원 / M2: 홍보국 국원
-- 홍보국에는 아직 활성화 전인 승인 행이 하나 있다
-- ---------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.admin.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.admin.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.admin.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.admin.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a2000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.admin.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e1000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d1000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d2000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a1000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a2000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

insert into public.approved_council_accounts (term_id, email, student_no, role, department_id)
select '00000000-0000-0000-0000-000000000001', 'test.pending.h@hanyang.ac.kr', '2026000099', 'MEMBER', d.id
from public.departments d
where d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '홍보국';

-- ---------------------------------------------------------------------
-- 학번 저장 위치와 형식
-- ---------------------------------------------------------------------
select hasnt_column('public', 'profiles', 'student_no',
  'profiles에는 학번 열이 없다 (같은 기수 구성원 모두가 읽는 테이블)');

select throws_ok(
  $$ insert into public.approved_council_accounts (term_id, email, student_no, role)
     values ('00000000-0000-0000-0000-000000000001', 'test.bad.no@hanyang.ac.kr', '12345', 'EXECUTIVE') $$,
  '23514',
  null,
  '숫자 10자리가 아닌 학번은 저장이 거부된다'
);

set local role authenticated;

-- ---------------------------------------------------------------------
-- 회장단 E: 일괄 등록 (D-18)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select row_no, error from public.register_approved_accounts(
       '00000000-0000-0000-0000-000000000001',
       jsonb_build_array(
         jsonb_build_object('email', 'Test.New1@hanyang.ac.kr', 'student_no', '2026000001',
           'department_id', (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국')),
         jsonb_build_object('email', 'test.new9@hanyang.ac.kr', 'student_no', '12345',
           'department_id', (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'))
       )) $$,
  $$ values (1, null::text), (2, '학번은 숫자 10자리여야 합니다.') $$,
  '회장단 E의 일괄 등록에서 올바른 행만 등록되고 잘못된 학번 행은 이유와 함께 거부된다'
);

select results_eq(
  $$ select row_no, error from public.register_approved_accounts(
       '00000000-0000-0000-0000-000000000001',
       jsonb_build_array(jsonb_build_object('email', 'test.new1@hanyang.ac.kr', 'student_no', '2026000002',
         'department_id', (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국')))) $$,
  $$ values (1, '이미 승인 명단에 있는 이메일입니다.') $$,
  '같은 기수에 이미 있는 이메일은 다시 등록되지 않는다'
);

select results_eq(
  $$ select row_no, error from public.register_approved_accounts(
       '00000000-0000-0000-0000-000000000001',
       jsonb_build_array(jsonb_build_object('email', 'someone@gmail.com', 'student_no', '2026000003', 'role', 'EXECUTIVE'))) $$,
  $$ values (1, '학교 이메일이 아닙니다.') $$,
  '학교 이메일이 아닌 행은 등록되지 않는다'
);

select results_eq(
  $$ select row_no, error from public.register_approved_accounts(
       '00000000-0000-0000-0000-000000000001',
       jsonb_build_array(jsonb_build_object('email', 'test.new4@hanyang.ac.kr', 'student_no', '2026000004', 'role', 'DIRECTOR',
         'department_id', (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국')))) $$,
  $$ values (1, '이 부서에는 이미 국장이 있습니다.') $$,
  '국장이 있는 부서에 국장을 한 명 더 등록할 수 없다'
);

-- ---------------------------------------------------------------------
-- 재무국 국장 D: 자기 국 국원만 관리, 자기 국 학번만 열람
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select row_no, error from public.register_approved_accounts(
       '00000000-0000-0000-0000-000000000001',
       jsonb_build_array(jsonb_build_object('email', 'test.new2@hanyang.ac.kr', 'student_no', '2026000005',
         'department_id', (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국')))) $$,
  $$ values (1, null::text) $$,
  '재무국 국장 D는 자기 국 국원을 등록할 수 있다'
);

select results_eq(
  $$ select row_no, error from public.register_approved_accounts(
       '00000000-0000-0000-0000-000000000001',
       jsonb_build_array(jsonb_build_object('email', 'test.new6@hanyang.ac.kr', 'student_no', '2026000006',
         'department_id', (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '홍보국')))) $$,
  $$ values (1, '국장은 자기 국의 국원(MEMBER)만 등록할 수 있습니다.') $$,
  '재무국 국장 D는 다른 국에 국원을 등록할 수 없다'
);

select is(
  (select count(*)::int from public.approved_council_accounts
   where student_no is not null
     and department_id = (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국')),
  2,
  '재무국 국장 D는 자기 국 승인 행의 학번 2건을 볼 수 있다'
);

select is_empty(
  $$ select * from public.approved_council_accounts
     where department_id = (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '홍보국') $$,
  '재무국 국장 D는 홍보국 승인 행과 학번을 볼 수 없다'
);

select is(
  (select (public.end_membership(
    (select id from public.memberships where user_id = 'a1000000-0000-0000-0000-000000000001' and is_active))).is_active),
  false,
  '재무국 국장 D는 자기 국 국원 M의 소속을 종료할 수 있다'
);

select throws_ok(
  $$ select public.end_membership(
       (select id from public.memberships where user_id = 'a2000000-0000-0000-0000-000000000002' and is_active)) $$,
  '42501',
  null,
  '재무국 국장 D는 홍보국 국원 M2의 소속을 종료할 수 없다'
);

select throws_ok(
  $$ select public.change_member_role(
       (select id from public.memberships where user_id = 'a2000000-0000-0000-0000-000000000002' and is_active),
       'EXECUTIVE', null) $$,
  '42501',
  null,
  '국장 D는 구성원의 Role을 바꿀 수 없다'
);

select throws_ok(
  $$ select public.create_department('00000000-0000-0000-0000-000000000001', '기획국') $$,
  '42501',
  null,
  '국장 D는 부서를 만들 수 없다'
);

-- ---------------------------------------------------------------------
-- 홍보국 국원 M2: 승인 명단·학번을 보거나 등록할 수 없다
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a2000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is_empty(
  $$ select * from public.approved_council_accounts $$,
  '홍보국 국원 M2는 같은 국 승인 행과 학번도 볼 수 없다'
);

select throws_ok(
  $$ select * from public.register_approved_accounts('00000000-0000-0000-0000-000000000001', '[]'::jsonb) $$,
  '42501',
  null,
  '국원 M2는 승인 명단을 등록할 수 없다'
);

-- ---------------------------------------------------------------------
-- 회장단 E: 소속·Role, 부서(D-17), 승인 행 정정·취소
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.end_membership(
       (select id from public.memberships where user_id = 'e1000000-0000-0000-0000-000000000001' and is_active)) $$,
  '55000',
  null,
  '마지막 회장단 E는 자기 소속을 종료할 수 없다'
);

select throws_ok(
  $$ select public.change_member_role(
       (select id from public.memberships where user_id = 'a2000000-0000-0000-0000-000000000002' and is_active),
       'DIRECTOR',
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '홍보국')) $$,
  '23505',
  null,
  '국장이 있는 홍보국에서 국원 M2를 국장으로 올릴 수 없다'
);

select is(
  (select (public.create_department('00000000-0000-0000-0000-000000000001', ' 기획국 ', 5)).name),
  '기획국',
  '회장단 E는 부서를 만들 수 있고 이름 앞뒤 공백은 지워진다'
);

select throws_ok(
  $$ select public.set_department_active(
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'), false) $$,
  '55000',
  null,
  '활성 구성원이 있는 재무국은 비활성화할 수 없다'
);

select is(
  (select (public.set_department_active(
    (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '기획국'), false)).is_active),
  false,
  '연결된 사람이 없는 기획국은 비활성화할 수 있다'
);

select throws_ok(
  $$ select public.set_approved_student_no(
       (select id from public.approved_council_accounts where email = 'test.new1@hanyang.ac.kr'), '20260A0001') $$,
  '22023',
  null,
  '학번을 숫자 10자리가 아닌 값으로 정정할 수 없다'
);

select is(
  (select (public.cancel_approved_account(
    (select id from public.approved_council_accounts where email = 'test.new1@hanyang.ac.kr'))).is_active),
  false,
  '회장단 E는 활성화 전 승인 행을 취소할 수 있다'
);

select * from finish();
rollback;
