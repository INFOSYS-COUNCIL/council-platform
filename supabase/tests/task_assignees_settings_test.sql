-- 여러 담당자·마감 임박 설정: 테스트 계정만 쓰며 모든 변경은 롤백한다.
begin;
select no_plan();
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('ee160000-0000-0000-0000-000000000001','authenticated','authenticated','test.multi.e@hanyang.ac.kr',now(),'{"provider":"google"}','{}'),
 ('dd160000-0000-0000-0000-000000000001','authenticated','authenticated','test.multi.d@hanyang.ac.kr',now(),'{"provider":"google"}','{}'),
 ('aa160000-0000-0000-0000-000000000001','authenticated','authenticated','test.multi.m1@hanyang.ac.kr',now(),'{"provider":"google"}','{}'),
 ('aa160000-0000-0000-0000-000000000002','authenticated','authenticated','test.multi.m2@hanyang.ac.kr',now(),'{"provider":"google"}','{}'),
 ('aa160000-0000-0000-0000-000000000003','authenticated','authenticated','test.multi.other@hanyang.ac.kr',now(),'{"provider":"google"}','{}'),
 ('bb160000-0000-0000-0000-000000000001','authenticated','authenticated','test.multi.student@hanyang.ac.kr',now(),'{"provider":"google"}','{}');
insert into public.memberships(term_id,user_id,role,department_id)
select '00000000-0000-0000-0000-000000000001', u.id, u.role::public.member_role, d.id
from (values
 ('ee160000-0000-0000-0000-000000000001'::uuid,'EXECUTIVE',null),
 ('dd160000-0000-0000-0000-000000000001'::uuid,'DIRECTOR','재무국'),
 ('aa160000-0000-0000-0000-000000000001'::uuid,'MEMBER','재무국'),
 ('aa160000-0000-0000-0000-000000000002'::uuid,'MEMBER','홍보국'),
 ('aa160000-0000-0000-0000-000000000003'::uuid,'MEMBER','홍보국')
) u(id,role,dept) left join public.departments d on d.term_id='00000000-0000-0000-0000-000000000001' and d.name=u.dept;
create temp table ids(name text primary key,id uuid);
grant select,insert on ids to authenticated;
set local role authenticated;
set local request.jwt.claims='{"sub":"ee160000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'legacy',(public.create_task('00000000-0000-0000-0000-000000000001',null,'기존 단일 배정','', 'aa160000-0000-0000-0000-000000000001')).id;
select is((select count(*)::int from public.task_assignees where task_id=(select id from ids where name='legacy')),1,'기존 단일 배정 API도 연결 목록을 저장한다');
insert into ids select 'shared',(public.create_task_with_assignees('00000000-0000-0000-0000-000000000001',null,'공동 업무',p_assignee_ids=>array['aa160000-0000-0000-0000-000000000001','aa160000-0000-0000-0000-000000000002','aa160000-0000-0000-0000-000000000002']::uuid[],p_visibility_mode=>'RESTRICTED')).id;
select is((select count(*)::int from public.task_assignees where task_id=(select id from ids where name='shared')),2,'서로 다른 국의 여러 담당자를 중복 없이 저장한다');
select is((select assigned_open_tasks from public.membership_responsibilities((select id from public.memberships where user_id='aa160000-0000-0000-0000-000000000002' and is_active))),1,'두 번째 담당자도 미완료 배정 업무로 집계한다');
select throws_ok($$select public.create_task_with_assignees('00000000-0000-0000-0000-000000000001',null,'실패할 업무',p_assignee_ids=>array['bb160000-0000-0000-0000-000000000001']::uuid[])$$,'22023',null,'소속 없는 사람의 배정을 거절한다');
select is((select count(*)::int from public.tasks where title='실패할 업무'),0,'담당자 저장 실패 시 업무 생성 전체를 롤백한다');
select throws_ok($$select public.update_task_with_assignees((select id from ids where name='shared'),'실패 수정',array['aa160000-0000-0000-0000-000000000001']::uuid[],'NORMAL','2026-12-10','2026-12-01')$$,'23514',null,'잘못된 날짜로 수정을 거절한다');
select is((select count(*)::int from public.task_assignees where task_id=(select id from ids where name='shared')),2,'업무 수정 실패 시 배정 변경도 롤백한다');
select throws_ok($$select public.set_task_assignees((select id from ids where name='shared'),array[null]::uuid[])$$,'22023',null,'null 담당자를 거절한다');
select throws_ok($$insert into public.task_assignees values((select id from ids where name='shared'),'aa160000-0000-0000-0000-000000000003')$$,'42501',null,'담당자 테이블에 직접 쓰지 못한다');
set local request.jwt.claims='{"sub":"aa160000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.tasks where id=(select id from ids where name='shared')),0,'담당하지 않은 국원에게 제한 업무를 숨긴다');
select is((select count(*)::int from public.task_assignees where task_id=(select id from ids where name='shared')),0,'제한 업무의 담당자 목록도 숨긴다');
select throws_ok($$select public.update_task_description((select id from ids where name='shared'),'침범')$$,'42501',null,'외부인은 설명을 수정하지 못한다');
set local request.jwt.claims='{"sub":"aa160000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.tasks where id=(select id from ids where name='shared')),1,'두 번째 담당자도 제한 업무를 읽는다');
select is((select count(*)::int from public.task_assignees where task_id=(select id from ids where name='shared')),2,'담당자는 공동 담당자 목록을 읽는다');
select is((public.update_task_description((select id from ids where name='shared'),'공동 설명')).description,'공동 설명','두 번째 담당자도 설명을 수정한다');
insert into ids select 'page',public.create_task_page((select id from ids where name='shared'),'\x00'::bytea,'\x00'::bytea);
select ok((select id from ids where name='page') is not null,'두 번째 담당자도 업무 글을 시작한다');
select is((public.change_task_status((select id from ids where name='shared'),'REVIEW')).status,'REVIEW'::public.task_status,'두 번째 담당자도 검토 요청을 보낸다');
select throws_ok($$select public.change_task_status((select id from ids where name='shared'),'DONE')$$,'42501',null,'공동 담당자도 국장 승인 없이 완료 처리하지 못한다');
select throws_ok($$select public.set_task_assignees((select id from ids where name='shared'),'{}')$$,'42501',null,'담당 국원은 다른 담당자를 바꾸지 못한다');
set local request.jwt.claims='{"sub":"ee160000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.set_task_assignees((select id from ids where name='shared'),array['aa160000-0000-0000-0000-000000000001']::uuid[]);
set local request.jwt.claims='{"sub":"aa160000-0000-0000-0000-000000000002","role":"authenticated"}';
select is((select count(*)::int from public.tasks where id=(select id from ids where name='shared')),0,'제외한 담당자는 제한 업무를 더 이상 읽지 못한다');
set local request.jwt.claims='{"sub":"ee160000-0000-0000-0000-000000000001","role":"authenticated"}';
select public.update_task((select id from ids where name='shared'),'기존 API 수정','aa160000-0000-0000-0000-000000000002','NORMAL',null,null);
select is((select array_agg(user_id) from public.task_assignees where task_id=(select id from ids where name='shared')),array['aa160000-0000-0000-0000-000000000002']::uuid[],'이전 단일 수정 API도 여러 담당자 목록을 일관되게 바꾼다');
reset role;
update public.memberships set is_active=false,left_at=now() where user_id='aa160000-0000-0000-0000-000000000002';
set local role authenticated;
set local request.jwt.claims='{"sub":"ee160000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((public.update_task_with_assignees((select id from ids where name='shared'),'비활성 담당자 보존',array['aa160000-0000-0000-0000-000000000002']::uuid[],'NORMAL',null,null)).title,'비활성 담당자 보존','정보 수정 시 기존 비활성 담당자를 보존한다');
select public.set_task_assignees((select id from ids where name='shared'),'{}');
select throws_ok($$select public.set_task_assignees((select id from ids where name='shared'),array['aa160000-0000-0000-0000-000000000002']::uuid[])$$,'22023',null,'비활성 구성원을 새로 배정하지 못한다');
set local request.jwt.claims='{"sub":"dd160000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.set_task_due_soon_days(7)$$,'42501',null,'국장은 마감 임박 기준을 수정하지 못한다');
set local request.jwt.claims='{"sub":"ee160000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((public.set_task_due_soon_days(7)).task_due_soon_days,7,'회장단은 마감 임박 기준을 저장한다');
select is((public.set_task_due_soon_days(0)).task_due_soon_days,0,'마감 당일 기준도 저장한다');
select throws_ok($$select public.set_task_due_soon_days(-1)$$,'22023',null,'음수 기준을 거절한다');
select throws_ok($$select public.set_task_due_soon_days(366)$$,'22023',null,'365일보다 큰 기준을 거절한다');
select throws_ok($$select public.set_task_due_soon_days(null)$$,'22023',null,'비어 있는 기준을 거절한다');
set local role anon;
select is((select task_due_soon_days from public.site_settings where id),0,'공통 마감 임박 기준은 읽을 수 있다');
select throws_ok($$select public.set_task_due_soon_days(3)$$,'42501',null,'비로그인 사용자는 기준을 수정하지 못한다');
select * from finish();
rollback;
