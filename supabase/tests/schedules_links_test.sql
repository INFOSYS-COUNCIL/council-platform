-- 일정 열람·생성·삭제 권한, 바로가기 관리 권한 테스트
-- 실행: npx supabase test db
begin;
select plan(9);

-- E: 회장단 / D: 재무국 국장 / M: 재무국 국원 / M2: 홍보국 국원 / S: 소속 없는 학생
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sc.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sc.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sc.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.sc.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sc.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e5000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d5000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('a5000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a5000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into ids
select 'secret', (public.create_event('00000000-0000-0000-0000-000000000001',
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  '재무 감사', '', null, null, 'RESTRICTED')).id;

select lives_ok(
  $$ select public.create_schedule('00000000-0000-0000-0000-000000000001', null, '전체 회의', true,
       null, null, '2026-11-20', '2026-11-20') $$,
  '국장 D는 / 기수 공통 종일 일정을 / 만들 수 있다'
);

select lives_ok(
  $$ select public.create_schedule('00000000-0000-0000-0000-000000000001', (select id from ids where name = 'secret'),
       '감사 준비 회의', false, '2026-11-21 10:00+09', '2026-11-21 11:00+09', null, null) $$,
  '국장 D는 / 관리하는 제한 행사에 시간 일정을 / 만들 수 있다'
);

select throws_ok(
  $$ select public.create_schedule('00000000-0000-0000-0000-000000000001', null, '거꾸로', false,
       '2026-11-21 11:00+09', '2026-11-21 10:00+09', null, null) $$,
  '23514', null,
  '국장 D의 / 종료가 시작보다 빠른 일정 생성이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}';

select results_eq(
  $$ select title from public.schedules order by title $$,
  $$ values ('전체 회의') $$,
  '홍보국 국원 M2는 / 기수 공통 일정만 보고 제한 행사 일정은 / 보지 못한다'
);

select throws_ok(
  $$ select public.create_schedule('00000000-0000-0000-0000-000000000001', null, '국원 일정', true,
       null, null, '2026-11-22', '2026-11-22') $$,
  '42501', '국장과 회장단만 기수 일정을 만들 수 있습니다.',
  '국원 M2의 / 기수 일정 생성이 / 거부된다'
);

select throws_ok(
  $$ select public.delete_schedule((select id from public.schedules where title = '전체 회의')) $$,
  '42501', '만든 사람이나 관리 권한이 있는 사람만 지울 수 있습니다.',
  '국원 M2의 / 남이 만든 일정 삭제가 / 거부된다'
);

-- 바로가기
select throws_ok(
  $$ select public.create_dashboard_link('인스타그램', 'https://instagram.com/x') $$,
  '42501', '회장단만 바로가기를 관리할 수 있습니다.',
  '국원 M2의 / 바로가기 추가가 / 거부된다'
);

set local request.jwt.claims = '{"sub":"e5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.create_dashboard_link('위험', 'http://example.com') $$,
  '23514', '이름(1~50자)과 https:// 로 시작하는 주소를 확인해 주세요.',
  '회장단 E의 / https가 아닌 바로가기 추가가 / 거부된다'
);

select public.create_dashboard_link('공용 Drive', 'https://drive.google.com/x');
set local request.jwt.claims = '{"sub":"b5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.dashboard_links),
  0,
  '소속 없는 학생 S는 / 바로가기를 / 볼 수 없다'
);

select * from finish();
rollback;
