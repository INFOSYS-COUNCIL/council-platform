begin;
select plan(3);

-- 1. 종료일이 시작일보다 빠르면 거부된다.
select throws_ok(
  $$
    insert into public.terms (name, status, starts_on, ends_on)
    values ('날짜 검증용 기수', 'DRAFT', '2027-03-01', '2027-02-28')
  $$,
  '23514',
  null,
  '종료일이 시작일보다 빠른 기수 생성은 거부된다'
);

-- 2. 이름 중복 검증에 사용할 가짜 기수를 준비한다.
insert into public.terms (name, status)
values ('이름 중복 검증용 기수', 'DRAFT');

select throws_ok(
  $$
    insert into public.terms (name, status)
    values ('이름 중복 검증용 기수', 'DRAFT')
  $$,
  '23505',
  null,
  '같은 이름의 기수 중복 생성은 거부된다'
);

-- 3. 로그인 사용자 역할로 바꿔 직접 수정이 차단되는지 확인한다.
set local role authenticated;

select throws_ok(
  $$
    update public.terms
    set name = '권한 없이 변경한 이름'
    where name = '이름 중복 검증용 기수'
  $$,
  '42501',
  null,
  'authenticated 사용자의 기수 직접 수정은 거부된다'
);

reset role;

select * from finish();
rollback;