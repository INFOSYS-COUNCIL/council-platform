-- 2차 피드백: 업무 삭제
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(5);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('ea000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dt.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('da000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dt.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('da000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.dt.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('aa000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dt.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('ea000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('da000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('da000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('aa000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

set local request.jwt.claims = '{"sub":"da000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids
select 'a', (public.create_task('00000000-0000-0000-0000-000000000001',
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  '지울 업무 A', '', 'aa000000-0000-0000-0000-000000000001')).id
union all
select 'b', (public.create_task('00000000-0000-0000-0000-000000000001',
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  '지울 업무 B')).id;

set local request.jwt.claims = '{"sub":"aa000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_task((select id from ids where name = 'a')) $$,
  '42501', null,
  '담당자인 국원도 / 업무를 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"da000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_task((select id from ids where name = 'a')) $$,
  '42501', null,
  '다른 국 국장은 / 재무국 업무를 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"da000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_task((select id from ids where name = 'a')) $$,
  '담당 국 국장은 / 자기 국 업무를 / 지울 수 있다'
);
select is(
  (select count(*)::int from public.tasks where id = (select id from ids where name = 'a')),
  0,
  '지운 업무는 / 목록에서 / 사라진다'
);

set local request.jwt.claims = '{"sub":"ea000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_task((select id from ids where name = 'b')) $$,
  '회장단은 / 어느 국 업무든 / 지울 수 있다'
);

select * from finish();
rollback;
