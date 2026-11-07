-- 회장단으로 바꿀 때 부서 인자를 빼고 호출할 수 있는지 (부서 인자 기본값 null)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(4);

-- E: 회장단 / M: 재무국 국원 / 재무국 국원으로 승인만 된(로그인 전) 행 하나
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dept.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dept.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e4000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('a4000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

insert into public.approved_council_accounts (id, term_id, email, role, department_id)
select 'c4000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
  'test.dept.pending@hanyang.ac.kr', 'MEMBER', d.id
from public.departments d
where d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '재무국';

set local role authenticated;
set local request.jwt.claims = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select department_id from public.change_member_role(
     p_membership_id => (select id from public.memberships
                         where user_id = 'a4000000-0000-0000-0000-000000000001' and is_active),
     p_role => 'EXECUTIVE')),
  null::uuid,
  '회장단 E는 / 부서 인자를 빼고 국원 M을 회장단으로 / 바꿀 수 있다'
);

select is(
  (select department_id from public.update_approved_account(
     p_account_id => 'c4000000-0000-0000-0000-000000000001',
     p_role => 'EXECUTIVE')),
  null::uuid,
  '회장단 E는 / 부서 인자를 빼고 로그인 전 승인 행을 회장단으로 / 바꿀 수 있다'
);

select throws_ok(
  $$ select public.change_member_role(
       p_membership_id => (select id from public.memberships
                           where user_id = 'a4000000-0000-0000-0000-000000000001' and is_active),
       p_role => 'MEMBER') $$,
  '22023', '회장단이 아니면 부서가 필요합니다.',
  '회장단 E의 / 부서 없이 국원으로 바꾸는 것이 / 거부된다'
);

select throws_ok(
  $$ select public.update_approved_account(
       p_account_id => 'c4000000-0000-0000-0000-000000000001',
       p_role => 'MEMBER') $$,
  '22023', '회장단이 아니면 부서가 필요합니다.',
  '회장단 E의 / 부서 없이 승인 행을 국원으로 바꾸는 것이 / 거부된다'
);

select * from finish();
rollback;
