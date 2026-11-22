-- 카드뉴스 틀·카드뉴스 권한
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(8);

insert into public.departments (term_id, name) values ('00000000-0000-0000-0000-000000000001', '카드시험국');

-- D: 국장 / M: 국원 / M2: 다른 국원 / S: 학생(소속 없음)
insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('d5100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.cn.d@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a5100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.cn.m@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('a5100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.cn.m2@hanyang.ac.kr', now(), '{"provider":"google"}', '{}'),
  ('b5100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.cn.s@hanyang.ac.kr', now(), '{"provider":"google"}', '{}');

insert into public.memberships (term_id, user_id, role, department_id)
select '00000000-0000-0000-0000-000000000001', u.user_id, u.role::public.member_role, d.id
from (values
  ('d5100000-0000-0000-0000-000000000001'::uuid, 'DIRECTOR'),
  ('a5100000-0000-0000-0000-000000000001'::uuid, 'MEMBER'),
  ('a5100000-0000-0000-0000-000000000002'::uuid, 'MEMBER')
) as u (user_id, role)
join public.departments d on d.term_id = '00000000-0000-0000-0000-000000000001' and d.name = '카드시험국';

create temp table ids (name text primary key, id uuid not null);
grant select, insert on ids to authenticated;
set local role authenticated;

set local request.jwt.claims = '{"sub":"a5100000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok(
  $$ select public.save_card_template(null, '00000000-0000-0000-0000-000000000001', '국원 틀', 1080, 1350, '#c9d4f5', null, null, '[]') $$,
  '42501', null,
  '국원은 / 카드뉴스 틀을 / 만들 수 없다'
);

set local request.jwt.claims = '{"sub":"d5100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 't', public.save_card_template(null, '00000000-0000-0000-0000-000000000001', '공지 틀', 1080, 1350, '#c9d4f5', null, null, '[]');
select ok((select id from ids where name = 't') is not null, '국장은 / 틀을 / 만들 수 있다');
select throws_ok(
  $$ select public.save_card_template((select id from ids where name = 't'), null, '공지 틀', 1080, 1350, '#c9d4f5', '11111111-1111-1111-1111-111111111111/a.png', null, '[]') $$,
  '22023', null,
  '다른 기수 폴더의 파일은 / 틀에 / 쓸 수 없다'
);

set local request.jwt.claims = '{"sub":"a5100000-0000-0000-0000-000000000001","role":"authenticated"}';
insert into ids select 'c', public.save_card_news(null, (select id from ids where name = 't'), '사물함 안내', '[]');
select ok((select id from ids where name = 'c') is not null, '국원은 / 카드뉴스를 / 만들 수 있다');

set local request.jwt.claims = '{"sub":"a5100000-0000-0000-0000-000000000002","role":"authenticated"}';
select throws_ok(
  $$ select public.save_card_news((select id from ids where name = 'c'), null, '남이 고침', '[]') $$,
  '42501', null,
  '다른 국원은 / 남의 카드뉴스를 / 고칠 수 없다'
);

set local request.jwt.claims = '{"sub":"d5100000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok(
  $$ select public.save_card_news((select id from ids where name = 'c'), null, '국장이 고침', '[]') $$,
  '국장은 / 국원이 만든 카드뉴스를 / 고칠 수 있다'
);
select throws_ok(
  $$ select public.delete_card_template((select id from ids where name = 't')) $$,
  '55000', null,
  '카드뉴스가 있는 틀은 / 지울 수 / 없다'
);

set local request.jwt.claims = '{"sub":"b5100000-0000-0000-0000-000000000001","role":"authenticated"}';
select is(
  (select count(*)::int from public.card_news where id = (select id from ids where name = 'c')),
  0,
  '학생회 구성원이 아니면 / 카드뉴스를 / 볼 수 없다'
);

select * from finish();
rollback;
