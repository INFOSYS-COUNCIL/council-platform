-- 재무국 업무(양식·문서) 권한
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(14);

insert into public.departments (term_id, name) values
  ('00000000-0000-0000-0000-000000000001', '재무시험국'),
  ('00000000-0000-0000-0000-000000000001', '다른시험국');

-- E: 회장단 / D: 재무국장 / A·B: 재무국원 / X: 다른 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e6100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.fn.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d6100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.fn.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.fn.a@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.fn.b@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'test.fn.x@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');
insert into public.memberships (term_id, user_id, role)
values ('00000000-0000-0000-0000-000000000001', 'e6100000-0000-0000-0000-000000000001', 'EXECUTIVE');
insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('d6100000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무시험국'),
  ('a6100000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무시험국'),
  ('a6100000-0000-0000-0000-000000000002'::uuid, 'MEMBER', '재무시험국'),
  ('a6100000-0000-0000-0000-000000000003'::uuid, 'MEMBER', '다른시험국')
) as u (user_id, role, dept)
join public.departments d on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;
set local role authenticated;

set local request.jwt.claims = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_finance_department((select id from public.departments where name = '재무시험국')) $$,
  '42501', null, '국장은 / 재무 담당 부서를 / 정할 수 없다'
);

set local request.jwt.claims = '{"sub":"e6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.set_finance_department((select id from public.departments where name = '재무시험국')) $$,
  '회장단은 / 재무 담당 부서를 / 정한다'
);

set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.save_finance_form(null, '00000000-0000-0000-0000-000000000001', '회계장부', false,
       '00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.xlsx', '회계장부.xlsx') $$,
  '42501', null, '재무국원은 / 양식을 / 등록할 수 없다'
);

set local request.jwt.claims = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.save_finance_form(null, '00000000-0000-0000-0000-000000000001', '회계장부', false,
       '00000000-0000-0000-0000-000000000001/../x.xlsx', '회계장부.xlsx') $$,
  '22023', null, '형식이 다른 파일 경로는 / 받지 / 않는다'
);
insert into ids select 'form', public.save_finance_form(null, '00000000-0000-0000-0000-000000000001', '회계장부', false,
  '00000000-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.xlsx', '회계장부.xlsx');
insert into ids select 'secret', public.save_finance_form(null, '00000000-0000-0000-0000-000000000001', '학생회비 납부자 명단', true,
  '00000000-0000-0000-0000-000000000001/22222222-2222-2222-2222-222222222222.xlsx', '명단.xlsx');

-- 국원 A가 만들면 담당자를 넣어도 미배정
set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'docA', public.create_finance_doc((select id from ids where name = 'form'), '11월 회계장부', '2026-2', null,
  'a6100000-0000-0000-0000-000000000001', 'c6100000-0000-0000-0000-000000000001');
select is(
  (select t.assignee_id from public.tasks t join public.finance_docs d on d.task_id = t.id where d.id = (select id from ids where name = 'docA')),
  null::uuid, '국원이 만든 업무는 / 담당자가 / 비어 있다'
);
select is(
  public.create_finance_doc((select id from ids where name = 'form'), '11월 회계장부', '2026-2', null, null, 'c6100000-0000-0000-0000-000000000001'),
  (select id from ids where name = 'docA'), '같은 요청 번호로 다시 만들면 / 처음 문서를 / 돌려준다'
);
select throws_ok(
  $$ select public.assign_finance_doc((select id from ids where name = 'docA'), 'a6100000-0000-0000-0000-000000000001') $$,
  '42501', null, '국원은 / 담당자를 / 지정할 수 없다'
);
select throws_ok(
  $$ select public.add_finance_doc_version((select id from ids where name = 'docA'),
       '00000000-0000-0000-0000-000000000001/33333333-3333-3333-3333-333333333333.xlsx', 'v.xlsx', '') $$,
  '42501', null, '담당자가 아니면 / 새 버전을 / 올릴 수 없다'
);

set local request.jwt.claims = '{"sub":"d6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.assign_finance_doc((select id from ids where name = 'docA'), 'a6100000-0000-0000-0000-000000000003') $$,
  '22023', null, '다른 국 사람은 / 담당자가 / 될 수 없다'
);
select lives_ok(
  $$ select public.assign_finance_doc((select id from ids where name = 'docA'), 'a6100000-0000-0000-0000-000000000001') $$,
  '재무국장은 / 국원을 / 담당자로 지정한다'
);
-- 민감 양식 문서: 국장이 만들고 A에게 배정
insert into ids select 'docS', public.create_finance_doc((select id from ids where name = 'secret'), '2학기 납부자 명단', '2026-2', null,
  'a6100000-0000-0000-0000-000000000001', null);

set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  public.add_finance_doc_version((select id from ids where name = 'docA'),
    '00000000-0000-0000-0000-000000000001/33333333-3333-3333-3333-333333333333.xlsx', '11월.xlsx', '1차 작성'),
  1, '담당자는 / 새 버전을 / 올린다'
);

set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000002","role":"authenticated"}';
select results_eq(
  $$ select title from public.finance_docs order by title $$,
  $$ values ('11월 회계장부') $$,
  '담당이 아닌 재무국원은 / 일반 문서만 보고 / 민감 문서는 못 본다'
);

set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is((select count(*)::int from public.finance_docs where id = (select id from ids where name = 'docS')), 1,
  '민감 문서도 / 담당자는 / 본다');

set local request.jwt.claims = '{"sub":"a6100000-0000-0000-0000-000000000003","role":"authenticated"}';
select is((select count(*)::int from public.finance_docs), 0, '다른 국 사람은 / 재무 문서를 / 보지 못한다');

select * from finish();
rollback;
