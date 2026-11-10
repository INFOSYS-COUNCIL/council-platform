-- 3차 피드백: 수정·삭제는 각 국 국장과 회장단만
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(9);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원 / S: 건의를 쓴 학생
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('eb000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dm.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('db000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dm.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('db000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.dm.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('ab000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dm.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('bb000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.dm.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('eb000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('db000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('db000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('ab000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

-- 건의: 학생이 쓰고 회장단이 재무국에 배정, 국원 M을 담당자로
set local request.jwt.claims = '{"sub":"bb000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 's', public.submit_suggestion('지울 건의', '내용', gen_random_uuid());

set local request.jwt.claims = '{"sub":"eb000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.assign_suggestion(
  (select id from ids where name = 's'),
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  'ab000000-0000-0000-0000-000000000001'
);

set local request.jwt.claims = '{"sub":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'm_msg', (public.add_suggestion_message((select id from ids where name = 's'), 'INTERNAL', '국원 메모')).id;

select throws_ok(
  $$ select public.update_suggestion_message((select id from ids where name = 'm_msg'), '고침') $$,
  '42501', null,
  '담당자인 국원은 / 자기가 쓴 메모도 / 고칠 수 없다'
);
select throws_ok(
  $$ select public.delete_suggestion((select id from ids where name = 's')) $$,
  '42501', null,
  '담당자인 국원은 / 건의를 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"db000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_suggestion((select id from ids where name = 's')) $$,
  '42501', null,
  '맡지 않은 국의 국장은 / 건의를 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"db000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.update_suggestion_message((select id from ids where name = 'm_msg'), '국장이 고침') $$,
  '맡은 국의 국장은 / 국원이 쓴 메모를 / 고칠 수 있다'
);
select lives_ok(
  $$ select public.delete_suggestion((select id from ids where name = 's')) $$,
  '맡은 국의 국장은 / 건의를 / 지울 수 있다'
);
select is(
  (select count(*)::int from public.suggestion_messages where id = (select id from ids where name = 'm_msg')),
  0,
  '건의를 지우면 / 답변·메모도 / 함께 지워진다'
);

-- 회의록: 국장 D가 만든 편집 중 회의록
insert into ids
select 'meet', (public.create_meeting('00000000-0000-0000-0000-000000000001', '지울 회의', now(),
  'db000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00')).id;

set local request.jwt.claims = '{"sub":"db000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_meeting((select id from ids where name = 'meet')) $$,
  '42501', null,
  '만들지 않은 국장 D2는 / 회의록을 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"db000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_meeting((select id from ids where name = 'meet')) $$,
  '만든 국장 D는 / 편집 중인 회의록을 / 바로 지울 수 있다'
);

-- 일정: 국장 D가 만든 일정을 국원 M은 못 고친다
insert into ids select 'sch', (public.create_schedule('00000000-0000-0000-0000-000000000001', null, '국장 일정', true,
  null, null, '2026-11-20', '2026-11-20')).id;
set local request.jwt.claims = '{"sub":"ab000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.update_schedule((select id from ids where name = 'sch'), '국원이 고침', true,
       null, null, '2026-11-20', '2026-11-20') $$,
  '42501', null,
  '국원은 / 국장이 만든 일정을 / 고칠 수 없다'
);

select * from finish();
rollback;
