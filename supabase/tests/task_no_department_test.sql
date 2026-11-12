-- 담당국 없는 업무와 관리 책임자 승인 테스트 (2차 QA)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(6);

-- E: 회장단 / D: 재무국 국장 / M: 재무국 국원 / M2: 홍보국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.tnd.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.tnd.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.tnd.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a9000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.tnd.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e9000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d9000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('a9000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a9000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

set local request.jwt.claims = '{"sub":"e9000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'e_task', (public.create_task('00000000-0000-0000-0000-000000000001', null, '담당국 없는 업무')).id;
select is(
  (select department_id from public.tasks where id = (select id from ids where name = 'e_task')),
  null::uuid,
  '회장단은 / 담당국 없는 업무를 / 만들 수 있다'
);

set local request.jwt.claims = '{"sub":"d9000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'd_task', (public.create_task(
  '00000000-0000-0000-0000-000000000001', null, '국장의 담당국 없는 업무', '',
  'a9000000-0000-0000-0000-000000000001')).id;
select ok(
  (select id from ids where name = 'd_task') is not null,
  '국장도 / 담당국 없는 업무를 / 만들 수 있다'
);

-- 담당국이 없으면 같은 국 국원이라도 담당자가 아니면 보이지 않는다
set local request.jwt.claims = '{"sub":"a9000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.tasks where id in (select id from ids)),
  0,
  '담당이 아닌 국원에게는 / 담당국 없는 업무가 / 보이지 않는다'
);

set local request.jwt.claims = '{"sub":"a9000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.tasks where id = (select id from ids where name = 'd_task')),
  1,
  '담당자 국원에게는 / 담당국 없는 업무가 / 보인다'
);
select is(
  (public.change_task_status((select id from ids where name = 'd_task'), 'REVIEW')).status,
  'REVIEW'::public.task_status,
  '담당자는 / 검토를 / 요청할 수 있다'
);

set local request.jwt.claims = '{"sub":"d9000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (public.change_task_status((select id from ids where name = 'd_task'), 'DONE')).status,
  'DONE'::public.task_status,
  '관리 책임자는 / 담당국 없는 업무의 검토를 / 승인할 수 있다'
);

select * from finish();
rollback;
