-- 국별 업무 자료 및 가이드라인(4차 QA)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(8);

-- 다른 데이터와 겹치지 않게 테스트 전용 국 두 개를 만든다
insert into public.departments (term_id, name) values
  ('00000000-0000-0000-0000-000000000001', '가이드시험A국'),
  ('00000000-0000-0000-0000-000000000001', '가이드시험B국');

-- D: A국 국장 / M: A국 국원 / D2: B국 국장 / M2: B국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('d4100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.gd.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.gd.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d4100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.gd.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.gd.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('d4100000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '가이드시험A국'),
  ('a4100000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '가이드시험A국'),
  ('d4100000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '가이드시험B국'),
  ('a4100000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '가이드시험B국')
) as u (user_id, role, dept)
join public.departments d on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

set local request.jwt.claims = '{"sub":"a4100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.create_guide(
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '가이드시험A국'),
       '국원이 쓴 가이드', '{}', '\x00'::bytea, '\x00'::bytea) $$,
  '42501', null,
  '일반 국원은 / 가이드를 / 만들 수 없다'
);

set local request.jwt.claims = '{"sub":"d4100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.create_guide(
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '가이드시험A국'),
       '남의 국 가이드', '{}', '\x00'::bytea, '\x00'::bytea) $$,
  '42501', null,
  '다른 국 국장은 / 그 국 가이드를 / 만들 수 없다'
);

set local request.jwt.claims = '{"sub":"d4100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'g', public.create_guide(
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '가이드시험A국'),
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

-- 가이드라인만 있는 국을 지우면 가이드라인이 함께 지워지지 않고 삭제가 막힌다
reset role;
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values ('e4100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.gd.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');
insert into public.memberships (term_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', 'e4100000-0000-0000-0000-000000000001', 'EXECUTIVE');
insert into public.departments (term_id, name) values ('00000000-0000-0000-0000-000000000001', '가이드만 있는 국');
set local role authenticated;
set local request.jwt.claims = '{"sub":"e4100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'g2', public.create_guide(
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '가이드만 있는 국'),
  '남길 가이드라인', '{}', '\x00'::bytea, '\x00'::bytea);
select throws_ok(
  $$ select public.delete_department((select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '가이드만 있는 국')) $$,
  '55000', null,
  '가이드라인이 있는 국은 / 삭제할 수 없다(사용 중지 안내)'
);
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'g2')),
  1,
  '국 삭제를 시도해도 / 가이드라인은 / 남아 있다'
);

select * from finish();
rollback;
