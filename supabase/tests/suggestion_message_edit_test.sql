-- 2차 피드백: 건의 답변·메모 수정·삭제
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(7);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / S: 건의를 쓴 학생
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e8000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sm.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d8000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sm.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d8000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.sm.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b8000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.sm.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e8000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d8000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d8000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

set local request.jwt.claims = '{"sub":"b8000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 's', public.submit_suggestion('수정 시험 건의', '내용', gen_random_uuid());

set local request.jwt.claims = '{"sub":"e8000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'e_msg', (public.add_suggestion_message((select id from ids where name = 's'), 'INTERNAL', '회장단 메모')).id;
select public.assign_suggestion(
  (select id from ids where name = 's'),
  (select id from public.departments where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국'),
  null
);

set local request.jwt.claims = '{"sub":"d8000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'd_msg', (public.add_suggestion_message((select id from ids where name = 's'), 'AUTHOR_VISIBLE', '첫 답변')).id;

select is(
  (public.update_suggestion_message((select id from ids where name = 'd_msg'), '  고친 답변  ')).body,
  '고친 답변',
  '쓴 사람은 / 자기 답변을 / 고칠 수 있다'
);
select ok(
  (select updated_at is not null from public.suggestion_messages where id = (select id from ids where name = 'd_msg')),
  '고친 답변에는 / 고친 시각이 / 남는다'
);
select throws_ok(
  $$ select public.update_suggestion_message((select id from ids where name = 'd_msg'), '   ') $$,
  '23514', null,
  '빈 내용으로는 / 고칠 수 없다'
);
select lives_ok(
  $$ select public.update_suggestion_message((select id from ids where name = 'e_msg'), '국장이 고친 메모') $$,
  '맡은 국의 국장은 / 회장단이 쓴 메모도 / 고칠 수 있다 (3차 피드백)'
);

set local request.jwt.claims = '{"sub":"d8000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_suggestion_message((select id from ids where name = 'd_msg')) $$,
  '42501', null,
  '다른 국 국장은 / 남의 답변을 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"e8000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.delete_suggestion_message((select id from ids where name = 'd_msg')) $$,
  '회장단은 / 국장이 쓴 답변을 / 지울 수 있다'
);
select is(
  (select count(*)::int from public.suggestion_messages where suggestion_id = (select id from ids where name = 's')),
  1,
  '지운 답변은 / 목록에서 / 사라진다'
);

select * from finish();
rollback;
