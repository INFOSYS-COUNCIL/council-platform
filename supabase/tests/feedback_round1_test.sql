-- 1차 피드백 반영: 일정 색, 바로가기 수정, Template 삭제, 보관 회의록 다시 열기·삭제
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(12);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.fb.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.fb.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d7000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.fb.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.fb.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e7000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d7000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d7000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a7000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. 일정 색
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d7000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (public.create_schedule('00000000-0000-0000-0000-000000000001', null, '색 없는 일정', true,
     null, null, '2026-11-20', '2026-11-20')).color,
  'coral',
  '색을 고르지 않은 일정은 / 기본 코랄색으로 / 저장된다'
);
select is(
  (public.create_schedule('00000000-0000-0000-0000-000000000001', null, '파란 일정', true,
     null, null, '2026-11-21', '2026-11-21', '', '', 'blue')).color,
  'blue',
  '고른 색이 / 일정에 / 저장된다'
);
select throws_ok(
  $$ select public.create_schedule('00000000-0000-0000-0000-000000000001', null, '이상한 색', true,
       null, null, '2026-11-22', '2026-11-22', '', '', 'black') $$,
  '23514', null,
  '목록에 없는 색은 / 거부된다'
);

-- ---------------------------------------------------------------------
-- 2. 바로가기 수정
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e7000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'link', (public.create_dashboard_link('학생회 Drive', 'https://drive.google.com/x')).id;

select is(
  (public.update_dashboard_link((select id from ids where name = 'link'), ' 공용 Drive ', 'https://drive.google.com/y', '설명', 2)).name,
  '공용 Drive',
  '회장단 E는 / 바로가기 이름·주소를 / 고칠 수 있다'
);

set local request.jwt.claims = '{"sub":"d7000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.update_dashboard_link((select id from ids where name = 'link'), '바꿈', 'https://x.example', '', 0) $$,
  '42501', null,
  '국장 D는 / 바로가기를 / 고칠 수 없다'
);

-- ---------------------------------------------------------------------
-- 3. Template 삭제
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e7000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'tpl_unused', (public.create_meeting_template('00000000-0000-0000-0000-000000000001', '안 쓴 양식', '[]')).id;
insert into ids select 'tpl_used', (public.create_meeting_template('00000000-0000-0000-0000-000000000001', '쓴 양식', '[]')).id;
insert into ids
select 'm_tpl', (public.create_meeting('00000000-0000-0000-0000-000000000001', '양식 회의', now(),
  'e7000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00',
  null, (select id from ids where name = 'tpl_used'))).id;

select lives_ok(
  $$ select public.delete_meeting_template((select id from ids where name = 'tpl_unused')) $$,
  '회장단 E는 / 아무 회의록도 쓰지 않은 Template을 / 삭제할 수 있다'
);
select throws_ok(
  $$ select public.delete_meeting_template((select id from ids where name = 'tpl_used')) $$,
  '55000', null,
  '회의록이 쓴 Template은 / 삭제하지 않고 / 사용 중지를 안내한다'
);

-- ---------------------------------------------------------------------
-- 4. 보관된 회의록 다시 열기·삭제
-- ---------------------------------------------------------------------
-- 회장단 E가 만들고 대표 작성자를 국장 D로 둔 회의록 / 대표 작성자가 국원 M인 회의록
insert into ids
select 'm_d', (public.create_meeting('00000000-0000-0000-0000-000000000001', '국장 작성 회의', now(),
  'd7000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00')).id;
insert into ids
select 'm_m', (public.create_meeting('00000000-0000-0000-0000-000000000001', '국원 작성 회의', now(),
  'a7000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00')).id;
select public.change_meeting_status((select id from ids where name = 'm_d'), 'ARCHIVED');
select public.change_meeting_status((select id from ids where name = 'm_m'), 'ARCHIVED');

set local request.jwt.claims = '{"sub":"d7000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_meeting((select id from ids where name = 'm_d')) $$,
  '42501', null,
  '대표 작성자가 아닌 국장 D2는 / 보관된 회의록을 / 삭제할 수 없다'
);

set local request.jwt.claims = '{"sub":"a7000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.change_meeting_status((select id from ids where name = 'm_m'), 'DRAFT') $$,
  '42501', null,
  '국원인 대표 작성자 M은 / 보관된 회의록을 / 다시 열 수 없다'
);

set local request.jwt.claims = '{"sub":"d7000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (public.change_meeting_status((select id from ids where name = 'm_d'), 'DRAFT')).status,
  'DRAFT'::public.meeting_status,
  '국장인 대표 작성자 D는 / 보관된 회의록을 / 다시 작성 중으로 돌릴 수 있다'
);
select lives_ok(
  $$ select public.delete_meeting((select id from ids where name = 'm_d')) $$,
  '국장인 대표 작성자 D는 / 보관하지 않은 회의록도 / 삭제할 수 있다 (3차 피드백)'
);

set local request.jwt.claims = '{"sub":"e7000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.delete_meeting((select id from ids where name = 'm_m'));
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'm_m')),
  0,
  '회장단 E는 / 보관된 회의록을 / 삭제할 수 있다'
);

select * from finish();
rollback;
