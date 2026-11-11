-- 소속 종료한 구성원에게 학생회 권한 다시 주기
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(5);

-- D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원(승인 명단으로 들어온 사람)
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('dd000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.re.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('dd000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.re.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('ad000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.re.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, 'DIRECTOR', d.id
from (values
  ('dd000000-0000-0000-0000-000000000001'::uuid, '재무국'),
  ('dd000000-0000-0000-0000-000000000002'::uuid, '홍보국')
) as u (user_id, dept)
join public.departments d on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

insert into public.approved_council_accounts (id, term_id, email, role, department_id, activated_user_id, activated_at)
select 'ae000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'test.re.m@hanyang.ac.kr',
  'MEMBER', d.id, 'ad000000-0000-0000-0000-000000000001', now()
from public.departments d where d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '재무국';

insert into public.memberships (term_id, user_id, role, department_id, approved_account_id)
select '00000000-0000-0000-0000-000000000001', 'ad000000-0000-0000-0000-000000000001', 'MEMBER', d.id,
  'ae000000-0000-0000-0000-000000000001'
from public.departments d where d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '재무국';

set local role authenticated;
set local request.jwt.claims = '{"sub":"dd000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.reactivate_membership('ae000000-0000-0000-0000-000000000001') $$,
  '55000', null,
  '아직 활동 중인 구성원은 / 다시 활성화할 / 필요가 없다'
);

select public.end_membership(
  (select id from public.memberships where approved_account_id = 'ae000000-0000-0000-0000-000000000001'));

set local request.jwt.claims = '{"sub":"dd000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.reactivate_membership('ae000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  '다른 국 국장은 / 재무국 국원에게 권한을 / 다시 줄 수 없다'
);

set local request.jwt.claims = '{"sub":"dd000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (public.reactivate_membership('ae000000-0000-0000-0000-000000000001')).is_active,
  true,
  '재무국 국장은 / 소속 종료한 자기 국 국원에게 / 권한을 다시 줄 수 있다'
);
select ok(
  (select left_at is null from public.memberships where approved_account_id = 'ae000000-0000-0000-0000-000000000001'),
  '다시 활성화하면 / 종료 시각이 / 지워진다'
);

set local request.jwt.claims = '{"sub":"ad000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.memberships where user_id = 'ad000000-0000-0000-0000-000000000001' and is_active),
  1,
  '다시 활성화된 국원은 / 학생회 구성원으로 / 다시 보인다'
);

select * from finish();
rollback;
