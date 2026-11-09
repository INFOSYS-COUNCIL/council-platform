-- 회의록 열람·편집·관리 권한, CRDT 저장 순번·중복 방지, 확정·해제, Template, Realtime 채널 권한 테스트
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(32);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원 / M2: 홍보국 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.mt.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.mt.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.mt.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a5000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.mt.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a5000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.mt.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e5000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d5000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d5000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a5000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a5000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
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
-- 1. 생성과 열람 범위 (6.2·6.3절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 재무국 회의록: 열람 범위 "특정 국 = 재무국", 편집자 M
insert into ids
select 'fin', (public.create_meeting('00000000-0000-0000-0000-000000000001', '  재무국 회의  ', now(),
  'd5000000-0000-0000-0000-000000000001', array['a5000000-0000-0000-0000-000000000001'::uuid],
  'DEPARTMENTS', array[(select id from dept where name = '재무국')], '\x0000', '\x00')).id;
-- 전체 공개 회의록: 편집자는 작성자 D뿐
insert into ids
select 'all', (public.create_meeting('00000000-0000-0000-0000-000000000001', '전체회의', now(),
  'd5000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00')).id;

select results_eq(
  $$ select title, status, crdt_seq from public.meeting_minutes where id = (select id from ids where name = 'fin') $$,
  $$ values ('재무국 회의', 'DRAFT'::public.meeting_status, 0::bigint) $$,
  '국장 D가 / 회의록을 만들면 / 작성 중, 순번 0으로 저장된다'
);

select results_eq(
  $$ select snapshot_version, last_sequence_no from public.meeting_crdt_snapshots
     where meeting_id = (select id from ids where name = 'fin') $$,
  $$ values (1, 0::bigint) $$,
  '회의록을 만들면 / 같은 트랜잭션에서 / 초기 Snapshot v1이 저장된다'
);

select results_eq(
  $$ select user_id from public.meeting_editors where meeting_id = (select id from ids where name = 'fin') order by user_id $$,
  $$ values ('a5000000-0000-0000-0000-000000000001'::uuid), ('d5000000-0000-0000-0000-000000000001'::uuid) $$,
  '대표 작성자 D는 / 지정하지 않아도 / 편집자에 들어간다'
);

select throws_ok(
  $$ select public.create_meeting('00000000-0000-0000-0000-000000000001', '범위 없음', now(),
       'd5000000-0000-0000-0000-000000000001', '{}', 'DEPARTMENTS', '{}', '\x0000', '\x00') $$,
  '22023', '열람할 국을 하나 이상 선택해 주세요.',
  '특정 국 범위에서 / 국을 고르지 않으면 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.create_meeting('00000000-0000-0000-0000-000000000001', '국원 회의록', now(),
       'a5000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00') $$,
  '42501', '국장과 회장단만 회의록을 만들 수 있습니다.',
  '국원 M의 / 회의록 생성이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.meeting_minutes where id in (select id from ids)),
  1,
  '홍보국 국원 M2는 / 전체 회의록만 보고 재무국 회의록은 / 보지 못한다'
);

set local request.jwt.claims = '{"sub":"e5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select count(*)::int from public.meeting_minutes where id in (select id from ids)),
  2,
  '회장단 E는 / 범위에 상관없이 / 두 회의록을 모두 본다'
);

-- ---------------------------------------------------------------------
-- 2. 본문 Update 저장 (6.5절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  public.save_meeting_update((select id from ids where name = 'fin'), '11111111-0000-0000-0000-000000000001', '\x0101'),
  1::bigint,
  '편집자 M이 / 본문 변경을 저장하면 / 순번 1을 받는다'
);

select is(
  public.save_meeting_update((select id from ids where name = 'fin'), '11111111-0000-0000-0000-000000000001', '\x0101'),
  1::bigint,
  '같은 client_update_id로 / 다시 보내면 / 새로 저장하지 않고 같은 순번을 받는다'
);

select is(
  public.save_meeting_update((select id from ids where name = 'fin'), '11111111-0000-0000-0000-000000000002', '\x0202'),
  2::bigint,
  '다음 변경은 / 이어지는 순번 2를 / 받는다'
);

select is(
  (select count(*)::int from public.meeting_crdt_updates where meeting_id = (select id from ids where name = 'fin')),
  2,
  '재시도를 포함해 세 번 보내도 / 저장된 Update는 / 두 개다'
);

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.save_meeting_update((select id from ids where name = 'fin'), gen_random_uuid(), '\x01') $$,
  '42501', '회의록을 찾을 수 없습니다.',
  '열람 권한이 없는 M2의 / 저장이 / 회의록이 없는 것처럼 거부된다'
);

select is(
  (select count(*)::int from public.meeting_crdt_updates where meeting_id = (select id from ids where name = 'fin')),
  0,
  '열람 권한이 없는 M2는 / 본문 Update를 / 읽지 못한다'
);

select throws_ok(
  $$ select public.save_meeting_update((select id from ids where name = 'all'), gen_random_uuid(), '\x01') $$,
  '42501', '이 회의록을 편집할 권한이 없습니다.',
  '열람만 가능한 M2의 / 전체 회의록 저장이 / 거부된다'
);

select throws_ok(
  $$ insert into public.meeting_crdt_updates (meeting_id, client_update_id, sequence_no, update_bytes, actor_id)
     values ((select id from ids where name = 'all'), gen_random_uuid(), 9, '\x01', 'a5000000-0000-0000-0000-000000000002') $$,
  '42501', null,
  'Update 테이블에 / 직접 insert하면 / 거부된다'
);

-- ---------------------------------------------------------------------
-- 3. 행사 회의록: 행사 열람 범위를 넘지 않는다 (1.7·5.2절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into ids
select 'secret_event', (public.create_event('00000000-0000-0000-0000-000000000001',
  (select id from dept where name = '재무국'), '재무 감사', '', null, null, 'RESTRICTED')).id;

select throws_ok(
  $$ select public.create_meeting('00000000-0000-0000-0000-000000000001', '감사 회의', now(),
       'd5000000-0000-0000-0000-000000000001', array['a5000000-0000-0000-0000-000000000002'::uuid],
       'ALL_COUNCIL', '{}', '\x0000', '\x00', (select id from ids where name = 'secret_event')) $$,
  '22023', '이 행사를 볼 수 없는 사람은 작성자·편집자로 지정할 수 없습니다.',
  '제한 행사 회의록에 / 행사를 볼 수 없는 M2를 편집자로 넣으면 / 거부된다'
);

select throws_ok(
  $$ select public.create_meeting('00000000-0000-0000-0000-000000000001', '감사 회의', now(),
       'd5000000-0000-0000-0000-000000000001', '{}', 'DEPARTMENTS',
       array[(select id from dept where name = '홍보국')], '\x0000', '\x00',
       (select id from ids where name = 'secret_event')) $$,
  '22023', '이 행사를 볼 수 없는 국은 열람 범위에 넣을 수 없습니다.',
  '제한 행사 회의록의 열람 범위에 / 행사를 볼 수 없는 홍보국을 넣으면 / 거부된다'
);

insert into ids
select 'event_meeting', (public.create_meeting('00000000-0000-0000-0000-000000000001', '감사 회의', now(),
  'd5000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00',
  (select id from ids where name = 'secret_event'))).id;

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is(
  (select count(*)::int from public.meeting_minutes where id = (select id from ids where name = 'event_meeting')),
  0,
  '열람 범위가 "전체"여도 / 행사를 볼 수 없는 M2는 / 행사 회의록을 보지 못한다'
);

-- ---------------------------------------------------------------------
-- 4. 확정·해제·보관 (6.8절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.confirm_meeting((select id from ids where name = 'fin'), '\x00', '\x00', 2) $$,
  '42501', '이 회의록을 관리할 권한이 없습니다.',
  '생성자가 아닌 편집자 M의 / 확정이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.confirm_meeting((select id from ids where name = 'fin'), '\x00', '\x00', 1) $$,
  '40001', '확정하는 동안 새 변경이 저장되었습니다. 다시 시도해 주세요.',
  '마지막 순번보다 오래된 Snapshot으로 / 확정하면 / 거부된다'
);

select results_eq(
  $$ select status from public.confirm_meeting((select id from ids where name = 'fin'), '\x00', '\x00', 2) $$,
  $$ values ('CONFIRMED'::public.meeting_status) $$,
  '생성자 D가 / 최신 Snapshot으로 확정하면 / 확정 상태가 된다'
);

select results_eq(
  $$ select snapshot_version, last_sequence_no from public.meeting_crdt_snapshots
     where meeting_id = (select id from ids where name = 'fin') order by snapshot_version desc limit 1 $$,
  $$ values (2, 2::bigint) $$,
  '확정하면 / 마지막 순번까지 담은 / 최종 Snapshot v2가 저장된다'
);

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.save_meeting_update((select id from ids where name = 'fin'), gen_random_uuid(), '\x01') $$,
  '55000', '확정되었거나 보관된 회의록은 고칠 수 없습니다.',
  '확정된 회의록은 / 편집자 M도 / 본문을 저장할 수 없다'
);

set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.change_meeting_status((select id from ids where name = 'fin'), 'DRAFT', '오타 수정') $$,
  '42501', '확정 해제와 보관 해제는 회장단만 할 수 있습니다.',
  '생성자인 국장 D의 / 확정 해제가 / 거부된다'
);

set local request.jwt.claims = '{"sub":"e5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.change_meeting_status((select id from ids where name = 'fin'), 'DRAFT') $$,
  '22023', '확정을 해제하는 사유를 입력해 주세요.',
  '회장단 E도 / 사유 없이는 / 확정을 해제할 수 없다'
);

select results_eq(
  $$ select status from public.change_meeting_status((select id from ids where name = 'fin'), 'DRAFT', '안건 추가') $$,
  $$ values ('DRAFT'::public.meeting_status) $$,
  '회장단 E가 / 사유와 함께 해제하면 / 다시 작성 중이 된다'
);

select is(
  (select after_summary ->> 'reason' from public.activity_logs
   where resource_type = 'MEETING' and resource_id = (select id from ids where name = 'fin')
   order by created_at desc, id desc limit 1),
  '안건 추가',
  '확정 해제 사유는 / 활동 기록에 / 남는다'
);

-- ---------------------------------------------------------------------
-- 5. Template (6.7절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.create_meeting_template('00000000-0000-0000-0000-000000000001', '국별회의', '[]') $$,
  '42501', '회장단만 할 수 있습니다.',
  '국장 D의 / Template 생성이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"e5000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into ids
select 'template', (public.create_meeting_template('00000000-0000-0000-0000-000000000001', '전체회의',
  '[{"type":"heading","content":"안건"}]')).id;
select public.set_meeting_template_active((select id from ids where name = 'template'), false);

set local request.jwt.claims = '{"sub":"d5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.create_meeting('00000000-0000-0000-0000-000000000001', '회의', now(),
       'd5000000-0000-0000-0000-000000000001', '{}', 'ALL_COUNCIL', '{}', '\x0000', '\x00',
       null, (select id from ids where name = 'template')) $$,
  '22023', '사용할 수 없는 Template입니다.',
  '비활성 Template으로 / 회의록을 만들면 / 거부된다'
);

-- ---------------------------------------------------------------------
-- 6. Realtime Private Channel (6.6절): realtime.messages RLS
-- ---------------------------------------------------------------------
select set_config('realtime.topic', 'meeting:' || (select id from ids where name = 'fin'), true);
set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ insert into realtime.messages (topic, extension, event, private)
     values (current_setting('realtime.topic'), 'broadcast', 'awareness', true) $$,
  '편집자 M은 / 회의록 채널에 / awareness를 보낼 수 있다'
);

set local request.jwt.claims = '{"sub":"a5000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ insert into realtime.messages (topic, extension, event, private)
     values (current_setting('realtime.topic'), 'presence', 'presence', true) $$,
  '42501', null,
  '열람 권한이 없는 M2는 / 회의록 채널에 / Presence를 게시할 수 없다'
);

select is(
  (select count(*)::int from realtime.messages where topic = current_setting('realtime.topic')),
  0,
  '열람 권한이 없는 M2는 / 회의록 채널의 메시지를 / 받지 못한다'
);

select * from finish();
rollback;
