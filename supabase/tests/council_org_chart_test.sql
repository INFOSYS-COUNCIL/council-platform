-- 공개 조직도 테스트 (2차 QA)
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(4);

-- E: 회장단(회장) / D: 재무국 국장 / X: 소속이 끝난 국원
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e6200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.oc.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d6200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.oc.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a6200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.oc.x@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');
update public.profiles set display_name = '시험회장' where id = 'e6200000-0000-0000-0000-000000000001';
update public.profiles set display_name = '시험국장' where id = 'd6200000-0000-0000-0000-000000000001';
update public.profiles set display_name = '끝난국원' where id = 'a6200000-0000-0000-0000-000000000001';

insert into public.memberships (term_id, user_id, role, department_id, position_id, is_active, left_at)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id, p.id, u.active, case when u.active then null else now() end
from (values
  ('e6200000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null, '회장', true),
  ('d6200000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국', '국장', true),
  ('a6200000-0000-0000-0000-000000000001'::uuid, 'MEMBER', '재무국', '국원', false)
) as u (user_id, role, dept, pos, active)
left join public.departments d on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept
left join public.positions p on p.term_id = '00000000-0000-0000-0000-000000000001' and p.name = u.pos;

set local role anon;
select is(
  (select position_name from public.council_org_chart() where name = '시험회장'),
  '회장',
  '로그인 전에도 / 조직도에서 회장단과 직책을 / 볼 수 있다'
);
select is(
  (select department_name from public.council_org_chart() where name = '시험국장'),
  '재무국',
  '국장은 / 자기 국과 함께 / 나온다'
);
select is(
  (select count(*)::int from public.council_org_chart() where name = '끝난국원'),
  0,
  '소속이 끝난 사람은 / 조직도에 / 나오지 않는다'
);
reset role;

select unalike(
  pg_get_function_result('public.council_org_chart'::regproc),
  '%email%',
  '공개 조직도는 / 이메일을 / 돌려주지 않는다'
);

select * from finish();
rollback;
