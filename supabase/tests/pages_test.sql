-- 페이지(기록 > 페이지) 테스트 (2차 QA)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(12);

-- E: 회장단 / M: 재무국 국원(만드는 사람) / M2: 홍보국 국원 / M3: 재무국 국원 / S: 학생회가 아닌 학생
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e6300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.pg.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.pg.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6300000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.pg.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6300000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'test.pg.m3@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b6300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.pg.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e6300000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('a6300000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a6300000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국'),
  ('a6300000-0000-0000-0000-000000000003'::uuid, 'MEMBER', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
insert into ids select 'fin', id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국';
grant select, insert on ids to authenticated;

set local role authenticated;

-- 학생회가 아니면 만들 수 없다
set local request.jwt.claims = '{"sub":"b6300000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.create_page('00000000-0000-0000-0000-000000000001', '몰래 페이지', '\x0000', '\x00') $$,
  '42501', null,
  '학생회가 아닌 학생은 / 페이지를 / 만들 수 없다'
);

-- 국원도 만든다: 담당국(재무국) 공개, 태그 정리
set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'p', (public.create_page('00000000-0000-0000-0000-000000000001', '  재무 안내  ', '\x0000', '\x00',
  array[' 예산 ', '예산', '', '회계'], 'DEPARTMENTS', array[(select id from ids where name = 'fin')])).id;
select is(
  (select array[title, kind, array_to_string(tags, ',')] from public.meeting_minutes where id = (select id from ids where name = 'p')),
  array['재무 안내', 'PAGE', '예산,회계'],
  '국원도 / 페이지를 만들고 / 태그는 정리되어 저장된다'
);

set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'p')),
  1,
  '담당국 공개 페이지는 / 같은 국 국원이 / 볼 수 있다'
);
select ok(
  private.can_edit_meeting((select id from ids where name = 'p')),
  '페이지를 볼 수 있으면 / 본문을 / 함께 고칠 수 있다'
);
select throws_ok(
  $$ select public.update_page((select id from ids where name = 'p'), '바꾼 제목', '{}', 'ALL_COUNCIL') $$,
  '42501', null,
  '만든 사람이 아닌 국원은 / 제목·공개 범위를 / 바꿀 수 없다'
);

set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'p')),
  0,
  '다른 국 국원은 / 담당국 공개 페이지를 / 볼 수 없다'
);

-- 지정 공개로 바꾸면 지정한 사람만
set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.update_page((select id from ids where name = 'p'), '재무 안내', '{}', 'USERS') $$,
  '22023', '공개할 사람을 한 명 이상 선택해 주세요.',
  '지정 공개는 / 사람을 하나 이상 / 골라야 한다'
);
select lives_ok(
  $$ select public.update_page((select id from ids where name = 'p'), '재무 안내', array['예산'], 'USERS', '{}',
       array['a6300000-0000-0000-0000-000000000002'::uuid]) $$,
  '만든 국원은 / 지정 공개로 / 바꿀 수 있다'
);

set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'p')),
  1,
  '지정된 사람은 / 다른 국이어도 / 볼 수 있다'
);

set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000003","role":"authenticated"}';
select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'p')),
  0,
  '지정되지 않은 같은 국 국원은 / 이제 / 볼 수 없다'
);
select throws_ok(
  $$ select public.delete_page((select id from ids where name = 'p')) $$,
  '42501', null,
  '볼 수 없는 사람은 / 페이지를 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"a6300000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_page((select id from ids where name = 'p')) $$,
  '만든 국원은 / 페이지를 / 지울 수 있다'
);

select * from finish();
rollback;
