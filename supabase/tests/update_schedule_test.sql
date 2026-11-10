-- 2차 피드백: 일정 수정
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(6);

-- E: 회장단 / D: 재무국 국장 / D2: 홍보국 국장
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.us.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d9000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.us.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d9000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.us.d2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e9000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d9000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국'),
  ('d9000000-0000-0000-0000-000000000002'::uuid, 'DIRECTOR', '홍보국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;

set local role authenticated;

set local request.jwt.claims = '{"sub":"d9000000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'sch', (public.create_schedule('00000000-0000-0000-0000-000000000001', null, '처음 제목', true,
  null, null, '2026-11-20', '2026-11-20')).id;

select is(
  (public.update_schedule((select id from ids where name = 'sch'), '고친 제목', false,
     '2026-11-21 10:00+09', '2026-11-21 12:00+09', null, null, '학생회실', 'green')).title,
  '고친 제목',
  '만든 사람은 / 일정을 / 고칠 수 있다'
);
select ok(
  (select not is_all_day and start_date is null and color = 'green' and location = '학생회실'
   from public.schedules where id = (select id from ids where name = 'sch')),
  '종일을 시간 일정으로 바꾸면 / 날짜 칸은 비고 / 색·장소도 바뀐다'
);
select is(
  (public.update_schedule((select id from ids where name = 'sch'), '메모 일정', true,
     null, null, '2026-11-21', '2026-11-21', '', 'green', '  준비물: 명찰  ')).description,
  '준비물: 명찰',
  '일정을 고칠 때 / 메모도 / 함께 저장된다'
);
select throws_ok(
  $$ select public.update_schedule((select id from ids where name = 'sch'), '거꾸로', false,
       '2026-11-21 12:00+09', '2026-11-21 10:00+09', null, null) $$,
  '23514', null,
  '종료가 시작보다 앞서면 / 거부된다'
);

set local request.jwt.claims = '{"sub":"d9000000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.update_schedule((select id from ids where name = 'sch'), '남의 일정', true,
       null, null, '2026-11-22', '2026-11-22') $$,
  '42501', null,
  '만든 사람이 아닌 국장은 / 일정을 / 고칠 수 없다'
);

set local request.jwt.claims = '{"sub":"e9000000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.update_schedule((select id from ids where name = 'sch'), '회장단이 고침', true,
       null, null, '2026-11-22', '2026-11-23') $$,
  '회장단은 / 남이 만든 일정도 / 고칠 수 있다'
);

select * from finish();
rollback;
