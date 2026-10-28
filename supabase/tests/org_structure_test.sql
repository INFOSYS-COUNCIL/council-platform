-- 1차 Migration 검사. 실행: npx supabase test db
begin;
select plan(7);

select has_table('public', 'terms', 'terms 테이블이 있다');
select has_table('public', 'departments', 'departments 테이블이 있다');
select has_table('public', 'positions', 'positions 테이블이 있다');

-- 허용: Seed가 들어갔다(postgres 역할은 RLS를 우회)
select ok((select count(*) from public.terms where status = 'ACTIVE') = 1, 'ACTIVE 기수는 하나다');

-- 거부: ACTIVE 기수를 하나 더 만들 수 없다
select throws_ok(
  $$ insert into public.terms (name, status) values ('두 번째 활성 기수', 'ACTIVE') $$,
  '23505',
  null,
  'ACTIVE 기수를 두 개 만들 수 없다'
);

-- 거부: 로그인하지 않은 사용자(anon)는 부서를 읽지 못한다
set local role anon;
select is_empty($$ select * from public.departments $$, 'anon은 부서를 볼 수 없다');

-- 거부: 로그인 사용자도 기수를 직접 만들 수 없다
set local role authenticated;
select throws_ok(
  $$ insert into public.terms (name) values ('직접 만든 기수') $$,
  '42501',
  null,
  'authenticated는 terms에 직접 INSERT할 수 없다'
);

select * from finish();
rollback;
