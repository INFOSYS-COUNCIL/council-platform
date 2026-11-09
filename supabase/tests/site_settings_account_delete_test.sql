-- 학생회 이름 설정, 활성화 전 승인 행 삭제의 허용/거부 테스트
-- 실행: npx supabase test db
-- 모든 계정과 학번은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(9);

-- E: 회장단 / D: 재무국 국장 / M: 재무국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e6000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ss.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d6000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ss.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ss.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e6000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d6000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('a6000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

-- 재무국 대기 행 하나, 홍보국 대기 행 하나
insert into public.approved_council_accounts (term_id, email, student_no, role, department_id)
select '00000000-0000-0000-0000-000000000001', v.email, v.student_no, 'MEMBER', d.id
from (values
  ('test.ss.pending1@hanyang.ac.kr', '2026000071', '재무국'),
  ('test.ss.pending2@hanyang.ac.kr', '2026000072', '홍보국')
) as v (email, student_no, dept)
join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = v.dept;

-- 로그인 전(anon)에도 이름을 읽는다
set local role anon;
select is(
  (select council_name from public.site_settings),
  '학생회',
  '로그인 전에도 / 학생회 이름을 / 읽을 수 있다'
);
select throws_ok(
  $$ select public.set_council_name('가온') $$,
  '42501', null,
  '로그인 전에는 / 학생회 이름을 / 바꿀 수 없다'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d6000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_council_name('가온') $$,
  '42501', '회장단만 학생회 이름을 바꿀 수 있습니다.',
  '국장 D는 / 학생회 이름을 / 바꿀 수 없다'
);
select throws_ok(
  $$ update public.site_settings set council_name = '가온' $$,
  '42501', null,
  '국장 D는 / 설정 표를 / 직접 고칠 수 없다'
);

-- 국장은 자기 국 대기 행만 지운다
select lives_ok(
  $$ select public.delete_approved_account(
       (select id from public.approved_council_accounts where email = 'test.ss.pending1@hanyang.ac.kr')) $$,
  '국장 D는 / 자기 국의 로그인 전 승인 행을 / 지울 수 있다'
);
select throws_ok(
  $$ select public.delete_approved_account(
       (select id from public.approved_council_accounts where email = 'test.ss.pending2@hanyang.ac.kr')) $$,
  '42501', null,
  '국장 D는 / 다른 국의 승인 행을 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"e6000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (public.set_council_name('  가온  ')).council_name,
  '가온',
  '회장단 E는 / 학생회 이름을 / 앞뒤 공백 없이 바꿀 수 있다'
);
select throws_ok(
  $$ select public.set_council_name('   ') $$,
  '23514', '학생회 이름은 1~30자로 입력해 주세요.',
  '빈 학생회 이름은 / 저장되지 않는다'
);
reset role;

-- 로그인한 행은 지우지 않는다
update public.approved_council_accounts
  set activated_user_id = 'a6000000-0000-0000-0000-000000000001', activated_at = now()
where email = 'test.ss.pending2@hanyang.ac.kr';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e6000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_approved_account(
       (select id from public.approved_council_accounts where email = 'test.ss.pending2@hanyang.ac.kr')) $$,
  '55000', null,
  '회장단 E도 / 로그인한 승인 행은 / 지울 수 없다'
);

select * from finish();
rollback;
