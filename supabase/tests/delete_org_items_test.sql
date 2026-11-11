-- 부서·직책 삭제: 회장단만, 쓰는 곳이 있으면 거부
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(6);

-- E: 회장단 / D: 재무국 국장
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('ec000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.org.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('dc000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.org.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('ec000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('dc000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub":"ec000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'dept', (public.create_department('00000000-0000-0000-0000-000000000001', '잘못 만든 국', 9)).id;
insert into ids select 'pos', (public.create_position('00000000-0000-0000-0000-000000000001', '잘못 만든 직책', 9)).id;

set local request.jwt.claims = '{"sub":"dc000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_department((select id from ids where name = 'dept')) $$,
  '42501', null,
  '국장은 / 부서를 / 지울 수 없다'
);

set local request.jwt.claims = '{"sub":"ec000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.delete_department((select id from public.departments
       where term_id = '00000000-0000-0000-0000-000000000001' and name = '재무국')) $$,
  '55000', null,
  '구성원이 있는 부서는 / 지우지 않고 / 사용 중지를 안내한다'
);
select lives_ok(
  $$ select public.delete_department((select id from ids where name = 'dept')) $$,
  '회장단은 / 아무도 쓰지 않는 부서를 / 지울 수 있다'
);
select is(
  (select count(*)::int from public.departments where id = (select id from ids where name = 'dept')),
  0,
  '지운 부서는 / 목록에서 / 사라진다'
);
select lives_ok(
  $$ select public.delete_position((select id from ids where name = 'pos')) $$,
  '회장단은 / 아무도 쓰지 않는 직책을 / 지울 수 있다'
);
select is(
  (select count(*)::int from public.positions where id = (select id from ids where name = 'pos')),
  0,
  '지운 직책은 / 목록에서 / 사라진다'
);

select * from finish();
rollback;
