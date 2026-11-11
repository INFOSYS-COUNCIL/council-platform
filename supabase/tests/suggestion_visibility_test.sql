-- 건의 공개 범위: 전체 공개 건의는 다른 학생도 보고, 학생회만 건의·내부 메모·작성자 신원은 숨긴다
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(7);

-- E: 회장단 / A: 건의를 쓴 학생 / B: 다른 학생
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('ef000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.vis.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('bf000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.vis.a@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('bf000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.vis.b@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');
insert into public.memberships (term_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', 'ef000000-0000-0000-0000-000000000001', 'EXECUTIVE');

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'public', public.submit_suggestion('공개 건의', '모두 보세요', gen_random_uuid(), 'PUBLIC');
insert into ids select 'council', public.submit_suggestion('비공개 건의', '학생회만', gen_random_uuid());

select throws_ok(
  $$ select public.submit_suggestion('이상한 범위', '내용', gen_random_uuid(), 'EVERYONE') $$,
  '22023', null,
  '목록에 없는 공개 범위는 / 거부된다'
);

set local request.jwt.claims = '{"sub":"ef000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.add_suggestion_message((select id from ids where name = 'public'), 'AUTHOR_VISIBLE', '공개 답변');
select public.add_suggestion_message((select id from ids where name = 'public'), 'INTERNAL', '내부 메모');

set local request.jwt.claims = '{"sub":"bf000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.suggestions where id = (select id from ids where name = 'public')),
  1,
  '다른 학생 B는 / 전체 공개 건의를 / 볼 수 있다'
);
select is(
  (select count(*)::int from public.suggestions where id = (select id from ids where name = 'council')),
  0,
  '다른 학생 B는 / 학생회만 건의를 / 볼 수 없다'
);
select results_eq(
  $$ select body from public.suggestion_messages where suggestion_id = (select id from ids where name = 'public') $$,
  $$ values ('공개 답변') $$,
  '다른 학생 B는 / 공개 건의의 공개 답변만 보고 / 내부 메모는 보지 못한다'
);
select is(
  (select count(*)::int from public.suggestion_authors where suggestion_id = (select id from ids where name = 'public')),
  0,
  '전체 공개여도 / 작성자 신원은 / 보이지 않는다'
);

set local request.jwt.claims = '{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.withdraw_suggestion((select id from ids where name = 'public'));
set local request.jwt.claims = '{"sub":"bf000000-0000-0000-0000-000000000002","role":"authenticated"}';
select is(
  (select count(*)::int from public.suggestions where id = (select id from ids where name = 'public')),
  0,
  '철회된 공개 건의는 / 다른 학생에게 / 더 보이지 않는다'
);

set local request.jwt.claims = '{"sub":"bf000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select visibility from public.suggestions where id = (select id from ids where name = 'council')),
  'COUNCIL',
  '공개 범위를 고르지 않으면 / 학생회만으로 / 저장된다'
);

select * from finish();
rollback;
