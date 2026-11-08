-- 행사 열람·관리 권한, 자료 등록, 건의 작성자 신원 분리·처리 권한 테스트
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(25);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원 / M2: 홍보국 국원 / S: 소속 없는 학생
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ev.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ev.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.ev.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ev.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a4000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.ev.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b4000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.ev.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e4000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d4000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d4000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a4000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a4000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

create temp view dept as
select name, id from public.departments where term_id = '00000000-0000-0000-0000-000000000001';
grant select on dept to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. 행사 생성·열람 (5.2·5.6절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into ids
select 'open', (public.create_event('00000000-0000-0000-0000-000000000001',
  (select id from dept where name = '재무국'), '  학생회 체육대회  ')).id;
insert into ids
select 'secret', (public.create_event('00000000-0000-0000-0000-000000000001',
  (select id from dept where name = '재무국'), '재무 감사 준비', '', null, null, 'RESTRICTED')).id;

select results_eq(
  $$ select name, status, manager_id from public.events where id = (select id from ids where name = 'open') $$,
  $$ values ('학생회 체육대회', 'PLANNING'::public.event_status, 'd4000000-0000-0000-0000-000000000001'::uuid) $$,
  '재무국 국장 D가 / 자기 국 행사를 만들면 / 기획 중 상태, 관리자 D로 저장된다'
);

select throws_ok(
  $$ select public.create_event('00000000-0000-0000-0000-000000000001',
       (select id from dept where name = '홍보국'), '남의 국 행사') $$,
  '42501', '국장은 자기 국 행사만 만들 수 있습니다.',
  '재무국 국장 D의 / 홍보국 행사 생성이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a4000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.events where id in (select id from ids)),
  1,
  '홍보국 국원 M2는 / 전체 공개 행사만 보고 재무국 제한 행사는 / 보지 못한다'
);

select throws_ok(
  $$ select public.change_event_status((select id from ids where name = 'open'), 'ACTIVE') $$,
  '42501', '이 행사를 관리할 권한이 없습니다.',
  '홍보국 국원 M2의 / 행사 상태 변경이 / 거부된다'
);

select lives_ok(
  $$ select public.add_event_link((select id from ids where name = 'open'),
       '참가 신청서', 'https://docs.google.com/forms/x') $$,
  '열람 가능한 국원 M2는 / 전체 공개 행사에 링크 자료를 / 등록할 수 있다'
);

select throws_ok(
  $$ select public.add_event_link((select id from ids where name = 'open'), '위험 링크', 'javascript:alert(1)') $$,
  '23514', '제목(1~100자)과 https:// 로 시작하는 주소를 확인해 주세요.',
  '국원 M2의 / https가 아닌 링크 등록이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.events where id = (select id from ids where name = 'secret')),
  1,
  '재무국 국원 M은 / 자기 국의 제한 공개 행사를 / 볼 수 있다'
);

-- ---------------------------------------------------------------------
-- 2. 상태 전환 (D-15)과 열람 대상
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.change_event_status((select id from ids where name = 'open'), 'COMPLETED') $$,
  '55000', '행사 상태는 한 단계씩만 바꿀 수 있습니다.',
  '국장 D의 / 기획 중 → 완료처럼 단계를 건너뛰는 변경이 / 거부된다'
);

select lives_ok(
  $$ select public.add_event_access_rule((select id from ids where name = 'secret'), 'USER',
       null, 'a4000000-0000-0000-0000-000000000002') $$,
  '국장 D는 / 관리하는 제한 행사에 홍보국 국원 M2를 열람 대상으로 / 추가할 수 있다'
);

set local request.jwt.claims = '{"sub":"a4000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.events where id = (select id from ids where name = 'secret')),
  1,
  '열람 대상으로 추가된 M2는 / 제한 행사를 / 볼 수 있다'
);

-- 다른 사용자가 올린 링크는 지울 수 없다(등록자·관리자만)
set local request.jwt.claims = '{"sub":"a4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.delete_event_resource((select id from public.event_resources where title = '참가 신청서')) $$,
  '42501', '자료를 등록한 사람이나 행사 관리자만 지울 수 있습니다.',
  '국원 M의 / 다른 사람이 등록한 자료 삭제가 / 거부된다'
);

select throws_ok(
  $$ select public.register_event_upload((select id from ids where name = 'open'), '가짜 파일',
       '00000000-0000-0000-0000-000000000001/' || (select id from ids where name = 'open') || '/x.pdf') $$,
  '22023', '올린 파일을 찾을 수 없습니다. 다시 올려 주세요.',
  '국원 M의 / 실제로 올리지 않은 파일 등록이 / 거부된다'
);

-- 파일 올리기 (5.3절): Storage 정책이 경로의 기수·행사와 열람 권한을 확인한다
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('event-files', '00000000-0000-0000-0000-000000000001/' || (select id from ids where name = 'open') || '/plan.pdf',
             'a4000000-0000-0000-0000-000000000001', '{"size": 2048}') $$,
  '열람 가능한 국원 M은 / 행사 경로에 파일을 / 올릴 수 있다'
);

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('event-files', '00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111/x.pdf',
             'a4000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  '국원 M의 / 없는 행사 경로로의 파일 올리기가 / 거부된다'
);

select is(
  (public.register_event_upload((select id from ids where name = 'open'), '체육대회 계획서',
     '00000000-0000-0000-0000-000000000001/' || (select id from ids where name = 'open') || '/plan.pdf')).size_bytes,
  2048::bigint,
  '국원 M이 / 자기가 올린 파일을 자료로 등록하면 / 파일 크기가 함께 저장된다'
);

-- ---------------------------------------------------------------------
-- 3. 건의 (7장): 작성자 신원 분리, 처리 권한, 공개 답변
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into ids
select 'sug', public.submit_suggestion('  과방 의자 교체  ', '의자가 많이 낡았습니다.', 'c4000000-0000-0000-0000-000000000001');

select is(
  public.submit_suggestion('과방 의자 교체', '의자가 많이 낡았습니다.', 'c4000000-0000-0000-0000-000000000001'),
  (select id from ids where name = 'sug'),
  '소속 없는 학생 S가 / 같은 요청 번호로 다시 제출하면 / 새 건의가 생기지 않고 처음 건의를 돌려받는다'
);

select results_eq(
  $$ select title, status from public.suggestions $$,
  $$ values ('과방 의자 교체', 'RECEIVED'::public.suggestion_status) $$,
  '학생 S는 / 자기 건의만 / 접수 상태로 본다'
);

set local request.jwt.claims = '{"sub":"e4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select author_user_id from public.suggestion_authors where suggestion_id = (select id from ids where name = 'sug')),
  'b4000000-0000-0000-0000-000000000001'::uuid,
  '회장단 E는 / 건의 작성자 신원을 / 볼 수 있다 (7.1절)'
);

select lives_ok(
  $$ select public.assign_suggestion((select id from ids where name = 'sug'),
       (select id from dept where name = '홍보국'), null) $$,
  '회장단 E는 / 건의를 홍보국에 / 배정할 수 있다'
);

set local request.jwt.claims = '{"sub":"d4000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.suggestions where id = (select id from ids where name = 'sug')),
  1,
  '배정 부서의 국장 D2는 / 배정된 건의를 / 볼 수 있다 (D-11)'
);

select is(
  (select count(*)::int from public.suggestion_authors),
  0,
  '처리자 국장 D2도 / 작성자 신원은 / 볼 수 없다 (7.1절)'
);

select throws_ok(
  $$ select public.change_suggestion_status((select id from ids where name = 'sug'), 'RESOLVED') $$,
  '55000', '처리 완료나 종료 전에 작성자에게 보이는 답변을 먼저 남겨 주세요.',
  '국장 D2의 / 공개 답변 없는 처리 완료가 / 거부된다 (D-10)'
);

select public.add_suggestion_message((select id from ids where name = 'sug'), 'INTERNAL', '예산 확인 필요');
select public.add_suggestion_message((select id from ids where name = 'sug'), 'AUTHOR_VISIBLE', '다음 달에 교체하겠습니다.');
select public.change_suggestion_status((select id from ids where name = 'sug'), 'RESOLVED');

set local request.jwt.claims = '{"sub":"a4000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.suggestions),
  0,
  '홍보국 국원 M2는 / 직접 배정되지 않은 건의를 / 볼 수 없다 (D-11)'
);

set local request.jwt.claims = '{"sub":"b4000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select body from public.suggestion_messages $$,
  $$ values ('다음 달에 교체하겠습니다.') $$,
  '작성자 S는 / 공개 답변만 보고 내부 메모는 / 보지 못한다 (7.2절)'
);

select throws_ok(
  $$ select public.withdraw_suggestion((select id from ids where name = 'sug')) $$,
  '55000', '처리가 시작된 건의는 철회할 수 없습니다.',
  '작성자 S의 / 처리 완료된 건의 철회가 / 거부된다 (D-9)'
);

select * from finish();
rollback;
