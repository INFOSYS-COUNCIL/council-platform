-- 업무(Task) 열람·변경 권한, 열람 대상(ACL), 활동 기록, 소속 종료 시 관리 책임 이전 테스트
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(40);

-- ---------------------------------------------------------------------
-- 준비 (postgres 역할), 2026 테스트 학생회
-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장 / M: 재무국 국원 / M2: 홍보국 국원 / S: 소속 없는 학생
-- ---------------------------------------------------------------------
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.task.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.task.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d3000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.task.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.task.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a3000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.task.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b3000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.task.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e3000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d3000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d3000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국'),
  ('a3000000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국'),
  ('a3000000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

-- 테스트 안에서 만든 업무 id를 이름으로 꺼내 쓴다
create temp table task_ids (name text primary key, id uuid not null);
grant select, insert on task_ids to authenticated;

create temp view dept as
select name, id from public.departments where term_id = '00000000-0000-0000-0000-000000000001';
grant select on dept to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------------
-- 1. 생성 (4.6절): 국장은 자기 국, 회장단은 전체, 국원은 불가
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into task_ids
select 'finance', (public.create_task(
  '00000000-0000-0000-0000-000000000001', (select id from dept where name = '재무국'),
  '  재무국 예산 정리  ', '', 'a3000000-0000-0000-0000-000000000001')).id;

select results_eq(
  $$ select title, manager_id, priority, status, visibility_mode from public.tasks
     where id = (select id from task_ids where name = 'finance') $$,
  $$ values ('재무국 예산 정리', 'd3000000-0000-0000-0000-000000000001'::uuid,
             'NORMAL'::public.task_priority, 'TODO'::public.task_status, 'DEFAULT'::public.visibility_mode) $$,
  '재무국 국장 D가 / 자기 국 업무를 만들면 / 관리 책임자는 D, 우선순위 NORMAL로 저장된다 (D-1, D-4)'
);

select throws_ok(
  $$ select public.create_task('00000000-0000-0000-0000-000000000001',
       (select id from dept where name = '홍보국'), '남의 국 업무') $$,
  '42501', '국장은 자기 국 업무만 만들 수 있습니다.',
  '재무국 국장 D의 / 홍보국 업무 생성이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.create_task('00000000-0000-0000-0000-000000000001',
       (select id from dept where name = '재무국'), '국원 업무') $$,
  '42501', '국장과 회장단만 업무를 만들 수 있습니다.',
  '재무국 국원 M의 / 업무 생성이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}';

-- 재무국 담당이지만 제한 공개, 담당자는 홍보국 국원 M2
insert into task_ids
select 'secret', (public.create_task(
  '00000000-0000-0000-0000-000000000001', (select id from dept where name = '재무국'),
  '협찬 계약 검토', '', 'a3000000-0000-0000-0000-000000000002', 'HIGH', null, null, 'RESTRICTED')).id;

insert into task_ids
select 'promo', (public.create_task(
  '00000000-0000-0000-0000-000000000001', (select id from dept where name = '홍보국'), '홍보 포스터')).id;

select throws_ok(
  $$ select public.create_task('00000000-0000-0000-0000-000000000001',
       (select id from dept where name = '재무국'), '날짜 오류', '', null, 'NORMAL', '2026-12-10', '2026-12-01') $$,
  '23514', null,
  '회장단 E의 / 시작일이 마감일보다 늦은 업무 생성이 / 거부된다'
);

select throws_ok(
  $$ select public.create_task('00000000-0000-0000-0000-000000000001',
       (select id from dept where name = '재무국'), '외부 담당자', '', 'b3000000-0000-0000-0000-000000000001') $$,
  '22023', '담당자는 이 기수의 활성 구성원이어야 합니다.',
  '회장단 E의 / 소속 없는 학생을 담당자로 지정한 업무 생성이 / 거부된다'
);

-- ---------------------------------------------------------------------
-- 2. 열람 (4.2절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'finance') $$,
  '재무국 국원 M은 / 자기 국 DEFAULT 업무를 / 볼 수 있다'
);
select is_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'secret') $$,
  '재무국 국원 M의 / 자기 국 RESTRICTED 업무 열람이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'secret') $$,
  '재무국 국장 D의 / 관리 책임자가 아닌 자기 국 RESTRICTED 업무 열람이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000002","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'secret') $$,
  '홍보국 국원 M2는 / 담당자로 지정된 다른 국 RESTRICTED 업무를 / 볼 수 있다'
);
select is_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'finance') $$,
  '홍보국 국원 M2의 / 권한 없는 다른 국 업무 열람이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'finance') $$,
  '홍보국 국장 D2의 / 다른 국 DEFAULT 업무 열람이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"b3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.tasks $$,
  '소속 없는 학생 S의 / 업무 열람이 / 모두 거부된다'
);

-- ---------------------------------------------------------------------
-- 3. 열람 대상(ACL) (4.3·4.5절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.add_task_access_rule((select id from task_ids where name = 'finance'), 'DEPARTMENT',
       (select id from dept where name = '홍보국')) $$,
  '재무국 국장 D는 / 자기 국 업무에 홍보국을 열람 대상으로 / 추가할 수 있다'
);

select throws_ok(
  $$ select public.add_task_access_rule((select id from task_ids where name = 'finance'), 'DEPARTMENT',
       (select id from dept where name = '홍보국')) $$,
  '23505', '이미 추가된 열람 대상입니다.',
  '재무국 국장 D의 / 같은 열람 대상 중복 추가가 / 거부된다'
);

select throws_ok(
  $$ select public.add_task_access_rule((select id from task_ids where name = 'finance'), 'USER',
       null, 'b3000000-0000-0000-0000-000000000001') $$,
  '22023', '열람 대상은 이 기수의 활성 구성원이어야 합니다.',
  '재무국 국장 D의 / 소속 없는 학생을 열람 대상으로 추가하는 것이 / 거부된다'
);

select throws_ok(
  $$ select public.add_task_access_rule((select id from task_ids where name = 'secret'), 'ROLE_GROUP',
       null, null, 'ALL_COUNCIL') $$,
  '42501', '업무를 찾을 수 없습니다.',
  '재무국 국장 D의 / 볼 수 없는 RESTRICTED 업무의 열람 대상 변경이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000002","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'finance') $$,
  '홍보국 국장 D2는 / 홍보국이 열람 대상으로 추가된 재무국 업무를 / 볼 수 있다'
);

set local request.jwt.claims = '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.add_task_access_rule((select id from task_ids where name = 'secret'), 'ROLE_GROUP',
       null, null, 'DIRECTORS') $$,
  '회장단 E는 / RESTRICTED 업무에 국장 그룹을 열람 대상으로 / 추가할 수 있다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select isnt_empty(
  $$ select 1 from public.tasks where id = (select id from task_ids where name = 'secret') $$,
  '재무국 국장 D는 / 국장 그룹이 열람 대상인 RESTRICTED 업무를 / 볼 수 있다'
);

select throws_ok(
  $$ select public.update_task((select id from task_ids where name = 'secret'), '제목 변경',
       null, 'NORMAL', null, null) $$,
  '42501', '이 업무의 제목·담당자·일정을 바꿀 권한이 없습니다.',
  '재무국 국장 D의 / 볼 수만 있는 RESTRICTED 업무 수정이 / 거부된다'
);

-- ---------------------------------------------------------------------
-- 4. 상태·필드 변경 (4.6절, D-2)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is(
  (select status from public.change_task_status((select id from task_ids where name = 'finance'), 'REVIEW')),
  'REVIEW'::public.task_status,
  '담당자 국원 M은 / 일을 마치면 / 검토 요청을 보낼 수 있다'
);

select throws_ok(
  $$ select public.change_task_status((select id from task_ids where name = 'finance'), 'DONE') $$,
  '42501', null,
  '담당자 국원 M은 / 스스로 완료 처리할 수 / 없다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(
  (select completed_at is not null and status = 'DONE'
   from public.change_task_status((select id from task_ids where name = 'finance'), 'DONE')),
  '재무국 국장 D가 / 검토 요청을 승인하면 / 완료되고 완료 시각이 기록된다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.change_task_status((select id from task_ids where name = 'finance'), 'IN_PROGRESS') $$,
  '42501', null,
  '담당자 국원 M은 / 완료된 업무를 / 되돌릴 수 없다'
);

set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select ok(
  (select completed_at is null and status = 'IN_PROGRESS'
   from public.change_task_status((select id from task_ids where name = 'finance'), 'IN_PROGRESS')),
  '국장 D가 / 완료 업무를 다시 진행 중으로 돌리면 / 완료 시각이 지워진다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$ select public.update_task((select id from task_ids where name = 'finance'), '담당자가 바꾼 제목',
       'a3000000-0000-0000-0000-000000000001', 'NORMAL', null, null) $$,
  '42501', '이 업무의 제목·담당자·일정을 바꿀 권한이 없습니다.',
  '담당자 M의 / 업무 제목 변경이 / 거부된다'
);

select lives_ok(
  $$ select public.update_task_description((select id from task_ids where name = 'finance'), '견적서 링크 추가') $$,
  '담당자 M은 / 자기 업무의 설명을 / 바꿀 수 있다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000002","role":"authenticated"}';

select throws_ok(
  $$ select public.change_task_status((select id from task_ids where name = 'promo'), 'DONE') $$,
  '42501', '담당자나 관리 권한이 있는 사람만 상태를 바꿀 수 있습니다.',
  '홍보국 국원 M2의 / 담당자가 아닌 자기 국 업무 상태 변경이 / 거부된다'
);

-- ---------------------------------------------------------------------
-- 5. 보관·복원, 관리 책임자
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"d3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select lives_ok(
  $$ select public.archive_task((select id from task_ids where name = 'finance')) $$,
  '재무국 국장 D는 / 자기 국 업무를 / 보관할 수 있다'
);

select throws_ok(
  $$ select public.change_task_status((select id from task_ids where name = 'finance'), 'REVIEW') $$,
  '55000', '보관된 업무입니다. 먼저 복원하세요.',
  '재무국 국장 D의 / 보관된 업무 상태 변경이 / 거부된다'
);

select lives_ok(
  $$ select public.restore_task((select id from task_ids where name = 'finance')) $$,
  '재무국 국장 D는 / 보관한 업무를 / 복원할 수 있다'
);

select throws_ok(
  $$ select public.set_task_manager((select id from task_ids where name = 'finance'),
       'a3000000-0000-0000-0000-000000000001') $$,
  '22023', '관리 책임자는 이 기수의 국장이나 회장단이어야 합니다.',
  '재무국 국장 D의 / 국원을 관리 책임자로 지정하는 것이 / 거부된다'
);

select lives_ok(
  $$ select public.set_task_manager((select id from task_ids where name = 'finance'),
       'd3000000-0000-0000-0000-000000000002') $$,
  '관리 책임자 D는 / 관리 책임을 다른 국장 D2에게 / 넘길 수 있다'
);

-- ---------------------------------------------------------------------
-- 6. 소속 종료 시 관리 책임 이전 (1.5절)
-- ---------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"e3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select results_eq(
  $$ select assigned_open_tasks, managed_open_tasks from public.membership_responsibilities(
       (select id from public.memberships where user_id = 'd3000000-0000-0000-0000-000000000002' and is_active)) $$,
  $$ values (0, 1) $$,
  '회장단 E는 / 종료 전에 D2가 관리 중인 미완료 업무 수를 / 볼 수 있다'
);

select lives_ok(
  $$ select public.end_membership(
       (select id from public.memberships where user_id = 'd3000000-0000-0000-0000-000000000002' and is_active)) $$,
  '회장단 E는 / 홍보국 국장 D2의 소속을 / 종료할 수 있다'
);

select is(
  (select manager_id from public.tasks where id = (select id from task_ids where name = 'finance')),
  'd3000000-0000-0000-0000-000000000001'::uuid,
  'D2가 관리하던 재무국 업무의 관리 책임은 / 재무국의 활성 국장 D에게 / 넘어간다'
);

-- ---------------------------------------------------------------------
-- 7. 직접 쓰기 금지와 활동 기록 (10.3절)
-- ---------------------------------------------------------------------
select throws_ok(
  $$ insert into public.tasks (term_id, department_id, title, creator_id, manager_id)
     values ('00000000-0000-0000-0000-000000000001', (select id from dept where name = '재무국'), '직접 생성',
       'e3000000-0000-0000-0000-000000000001', 'e3000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  '회장단 E도 / 업무 테이블에 직접 INSERT하는 것이 / 거부된다'
);

select results_eq(
  $$ select action from public.activity_logs
     where resource_type = 'TASK' and resource_id = (select id from task_ids where name = 'finance')
     order by id $$,
  $$ values ('CREATE'), ('ACL_ADD'), ('STATUS_CHANGE'), ('REOPEN'), ('DESCRIPTION_UPDATE'),
            ('ARCHIVE'), ('RESTORE'), ('MANAGER_CHANGE'), ('MANAGER_CHANGE') $$,
  '회장단 E는 / 업무의 변경 이력을 / 순서대로 볼 수 있다'
);

select throws_ok(
  $$ delete from public.activity_logs $$,
  '42501', null,
  '회장단 E도 / 활동 기록을 지우는 것이 / 거부된다'
);

set local request.jwt.claims = '{"sub":"a3000000-0000-0000-0000-000000000001","role":"authenticated"}';

select is_empty(
  $$ select 1 from public.activity_logs
     where resource_id = (select id from task_ids where name = 'secret') $$,
  '재무국 국원 M의 / 볼 수 없는 RESTRICTED 업무의 활동 기록 열람이 / 거부된다'
);

select * from finish();
rollback;
