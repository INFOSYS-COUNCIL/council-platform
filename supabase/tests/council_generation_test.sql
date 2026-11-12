-- 학생회 기수 설정의 허용/거부 테스트
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(6);

-- E: 회장단 / D: 재무국 국장
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('e7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.cg.e@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('d7000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.cg.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('e7000000-0000-0000-0000-000000000001'::uuid, 'EXECUTIVE', null),
  ('d7000000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR', '재무국')
) as u (user_id, role, dept)
left join public.departments d
  on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = u.dept;

-- 로그인 전(anon)에도 기수를 읽고(처음엔 비어 있음), 바꾸지는 못한다
set local role anon;
select is(
  (select council_generation from public.site_settings),
  null::integer,
  '로그인 전에도 / 아직 정하지 않은 기수를 / 읽을 수 있다'
);
select throws_ok(
  $$ select public.set_council_generation(17) $$,
  '42501', null,
  '로그인 전에는 / 기수를 / 바꿀 수 없다'
);
reset role;

set local role authenticated;
set local request.jwt.claims = '{"sub":"d7000000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.set_council_generation(17) $$,
  '42501', '회장단만 학생회 기수를 바꿀 수 있습니다.',
  '국장 D는 / 기수를 / 바꿀 수 없다'
);

set local request.jwt.claims = '{"sub":"e7000000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (public.set_council_generation(17)).council_generation,
  17,
  '회장단 E는 / 기수를 / 정할 수 있다'
);
select throws_ok(
  $$ select public.set_council_generation(0) $$,
  '23514', '기수는 1~999 사이의 숫자로 입력해 주세요.',
  '회장단 E도 / 범위 밖 기수는 / 저장할 수 없다'
);
select is(
  (public.set_council_generation(null)).council_generation,
  null::integer,
  '회장단 E는 / 기수를 / 비울 수 있다'
);

select * from finish();
rollback;
