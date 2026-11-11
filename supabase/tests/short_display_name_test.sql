-- 표시 이름 줄이기: "이름 | 학과 | 캠퍼스"에서 이름만 남긴다
-- 실행: npx supabase test db
-- 모든 계정은 가짜다. 트랜잭션 끝에 rollback되어 DB에 남지 않는다.
begin;
select plan(2);

insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
  ('f1000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'test.name.a@hanyang.ac.kr', now(),
   '{"provider":"google"}', '{"full_name":"홍길동 | 정보시스템학과 | 한양대(서울)"}'),
  ('f1000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'test.name.b@hanyang.ac.kr', now(),
   '{"provider":"google"}', '{"full_name":"김철수"}');

select is(
  (select display_name from public.profiles where id = 'f1000000-0000-0000-0000-000000000001'),
  '홍길동',
  '"이름 | 학과 | 캠퍼스" 꼴의 Google 이름은 / 이름만 / 저장된다'
);
select is(
  (select display_name from public.profiles where id = 'f1000000-0000-0000-0000-000000000002'),
  '김철수',
  '"|"가 없는 이름은 / 그대로 / 저장된다'
);

select * from finish();
rollback;
