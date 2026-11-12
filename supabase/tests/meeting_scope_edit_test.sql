-- 회의록 열람 범위 수정 테스트 (2차 QA)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(5);

-- D: 재무국 국장(만든 사람) / D2: 홍보국 국장 / M2: 홍보국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('d6100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ms.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d6100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.ms.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.ms.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('d6100000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d6100000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a6100000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
insert into ids select 'fin', id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국';
insert into ids select 'pr', id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '홍보국';
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids
select 'm', (public.create_meeting('00000000-0000-0000-0000-000000000001', '범위 시험 회의', now(),
  'd6100000-0000-0000-0000-000000000001', '{}', 'DEPARTMENTS', array[(select id from ids where name = 'fin')],
  '\x0000', '\x00')).id;

-- 처음엔 재무국만: 홍보국 국원은 못 본다
set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'm')),
  0,
  '재무국만 열람일 때 / 홍보국 국원은 / 볼 수 없다'
);

set local request.jwt.claims = '{"sub":"d6100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.set_meeting_scope((select id from ids where name = 'm'), 'ALL_COUNCIL') $$,
  '42501', null,
  '만든 사람이 아닌 국장은 / 열람 범위를 / 바꿀 수 없다'
);

set local request.jwt.claims = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_meeting_scope((select id from ids where name = 'm'), 'DEPARTMENTS', '{}') $$,
  '22023', '열람할 국을 하나 이상 선택해 주세요.',
  '국을 고르지 않고 / 특정 국 범위로는 / 바꿀 수 없다'
);
select lives_ok(
  $$ select public.set_meeting_scope((select id from ids where name = 'm'), 'DEPARTMENTS',
       array[(select id from ids where name = 'fin'), (select id from ids where name = 'pr')]) $$,
  '만든 국장은 / 열람 범위를 / 바꿀 수 있다'
);

set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'm')),
  1,
  '홍보국을 넣으면 / 홍보국 국원도 / 볼 수 있다'
);

select * from finish();
rollback;
