-- 국별 업무 자료 및 가이드라인(4차 QA)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(6);

-- D: 재무국 국장 / M: 재무국 국원 / D2: 홍보국 국장 / M2: 홍보국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('d4100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.gd.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.gd.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d4100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.gd.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.gd.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('d4100000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('a4100000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('d4100000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a4100000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
join public.departments d on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

set local request.jwt.claims = '{"sub":"a4100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.create_guide(
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
       '국원이 쓴 가이드', '{}', '\x00'::bytea, '\x00'::bytea) $$,
  '42501', null,
  '일반 국원은 / 가이드를 / 만들 수 없다'
);

set local request.jwt.claims = '{"sub":"d4100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.create_guide(
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
       '남의 국 가이드', '{}', '\x00'::bytea, '\x00'::bytea) $$,
  '42501', null,
  '다른 국 국장은 / 그 국 가이드를 / 만들 수 없다'
);

set local request.jwt.claims = '{"sub":"d4100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'g', public.create_guide(
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  '영수증 정리하는 법', array['개강총회'], '\x00'::bytea, '\x00'::bytea);
select ok(
  (select id from ids where name = 'g') is not null,
  '국장은 / 자기 국 가이드를 / 만들 수 있다'
);

set local request.jwt.claims = '{"sub":"a4100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'g')),
  1,
  '다른 국 국원도 / 가이드를 / 읽을 수 있다'
);
select ok(
  not private.can_edit_meeting((select id from ids where name = 'g')),
  '다른 국 국원은 / 가이드 본문을 / 고칠 수 없다'
);

set local request.jwt.claims = '{"sub":"a4100000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  not private.can_edit_meeting((select id from ids where name = 'g')),
  '같은 국 국원도 / 가이드 본문은 / 고칠 수 없다(읽기만)'
);

select * from finish();
rollback;
