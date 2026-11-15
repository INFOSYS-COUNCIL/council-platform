-- 3차 QA: 국원은 건의를 처리하지 않음, 작성자 답변 승인, 알림, 업무 글(페이지 연동)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(16);

-- E: 회장단 / D: 재무국 국장 / M: 재무국 국원 / D2: 홍보국 국장 / M2: 홍보국 국원 / S: 학생(건의 작성자)
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.q3.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.q3.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.q3.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d3000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.q3.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a3000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.q3.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.q3.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e3000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d3000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('a3000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('d3000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a3000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------
-- 건의: 제출 알림, 국원 배정 거부, 국원 열람 차단
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 's', public.submit_suggestion('시험 건의', '시험 내용', gen_random_uuid());

set local request.jwt.claims = '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.notifications where suggestion_id = (select id from ids where name = 's') and kind = 'SUGGESTION_SUBMITTED'),
  1,
  '새 건의가 들어오면 / 회장단에게 / 알림이 간다'
);
select throws_ok(
  $$ select public.assign_suggestion((select id from ids where name = 's'),
       (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
       'a3000000-0000-0000-0000-000000000001') $$,
  '22023', null,
  '건의 담당자로 / 일반 국원을 / 고를 수 없다'
);
select public.assign_suggestion((select id from ids where name = 's'),
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'), null);

-- 예전 규칙으로 국원에게 직접 배정돼 있던 경우도 국원에게는 보이지 않는다
reset role;
update public.suggestions set assigned_user_id = 'a3000000-0000-0000-0000-000000000001' where id = (select id from ids where name = 's');
set local role authenticated;

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.suggestions where id = (select id from ids where name = 's')),
  0,
  '일반 국원은 / 배정 국이나 직접 배정이어도 / 건의 제목·내용을 볼 수 없다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.notifications where suggestion_id = (select id from ids where name = 's') and kind = 'SUGGESTION_ASSIGNED'),
  1,
  '건의가 배정되면 / 그 국 국장에게 / 알림이 간다'
);

-- ---------------------------------------------------------------------
-- 답변 승인
-- ---------------------------------------------------------------------
insert into ids select 'answer', (public.add_suggestion_message((select id from ids where name = 's'), 'AUTHOR_VISIBLE', '답변 초안')).id;

set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.suggestion_messages where suggestion_id = (select id from ids where name = 's')),
  0,
  '승인 전 답변은 / 작성자에게 / 보이지 않는다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.change_suggestion_status((select id from ids where name = 's'), 'RESOLVED') $$,
  '55000', null,
  '승인된 답변이 없으면 / 답변 완료로 / 바꿀 수 없다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.approve_suggestion_message((select id from ids where name = 'answer')) $$,
  '42501', null,
  '다른 국 국장은 / 답변을 / 승인할 수 없다'
);

set local request.jwt.claims = '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (public.approve_suggestion_message((select id from ids where name = 'answer'))).approved_at is not null,
  '회장단은 / 답변을 / 승인할 수 있다'
);

set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select results_eq(
  $$ select body from public.suggestion_messages where suggestion_id = (select id from ids where name = 's') $$,
  $$ values ('답변 초안') $$,
  '승인된 답변은 / 작성자에게 / 보인다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select ok(
  (public.update_suggestion_message((select id from ids where name = 'answer'), '고친 답변')).approved_at is null,
  '승인된 답변을 고치면 / 다시 / 승인 대기가 된다'
);

-- ---------------------------------------------------------------------
-- 업무 알림·업무 글
-- ---------------------------------------------------------------------
insert into ids select 'task', (public.create_task(
  '00000000-0000-0000-0000-000000000001',
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  '공지글 쓰기', '', 'a3000000-0000-0000-0000-000000000001')).id;

set local request.jwt.claims = '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.notifications where task_id = (select id from ids where name = 'task')),
  1,
  '새 업무가 생기면 / 회장단에게 / 알림이 간다'
);
select public.mark_notifications_read();
select is(
  (select count(*)::int from public.notifications where read_at is null),
  0,
  '알림을 열면 / 내 알림이 모두 / 읽음이 된다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.notifications),
  0,
  '일반 국원에게는 / 업무·건의 알림이 / 가지 않는다'
);

insert into ids select 'page', public.create_task_page((select id from ids where name = 'task'), '\x00'::bytea, '\x00'::bytea);
select is(
  (select page_id from public.tasks where id = (select id from ids where name = 'task')),
  (select id from ids where name = 'page'),
  '담당자는 / 업무 글 페이지를 / 시작할 수 있다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'page')),
  1,
  '업무를 볼 수 있는 국장은 / 업무 글 페이지도 / 볼 수 있다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'page')),
  0,
  '업무를 볼 수 없는 다른 국 국원은 / 업무 글 페이지도 / 볼 수 없다'
);

select * from finish();
rollback;
