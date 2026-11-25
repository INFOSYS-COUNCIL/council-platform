begin;
select no_plan();

select is((select file_size_limit from storage.buckets where id='activity-photos'),20971520::bigint,
 '활동 사진 버킷은 / 장당 20MB까지 / 허용한다');

insert into auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select ('f7300000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
  'authenticated','authenticated','test.photos.' || n || '@hanyang.ac.kr',now(),
  '{"provider":"google"}','{"email_verified":true,"custom_claims":{"hd":"hanyang.ac.kr"}}'
from generate_series(1,4) n;

insert into public.memberships(term_id,user_id,role,department_id)
select '00000000-0000-0000-0000-000000000001',u.id,u.role::public.member_role,d.id
from (values
  ('f7300000-0000-0000-0000-000000000001'::uuid,'EXECUTIVE'),
  ('f7300000-0000-0000-0000-000000000002'::uuid,'DIRECTOR'),
  ('f7300000-0000-0000-0000-000000000003'::uuid,'MEMBER')
) u(id,role)
join public.departments d on d.term_id='00000000-0000-0000-0000-000000000001' and d.name='사무국';

create function pg_temp.photo_body(p_id text)
returns jsonb language sql as $$
select jsonb_build_array(jsonb_build_object('type','image','props',jsonb_build_object('url',
 '/photos/' || p_id || '/images/f7300000-0000-0000-0000-000000000001/c7300000-0000-0000-0000-000000000001.png')))
$$;

set local role authenticated;
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$
 insert into storage.objects(bucket_id,name,owner_id) values ('activity-photos',
 'a7300000-0000-0000-0000-000000000001/f7300000-0000-0000-0000-000000000001/c7300000-0000-0000-0000-000000000001.png',
 'f7300000-0000-0000-0000-000000000001')
$$,'회장단은 / 자기 경로에 / 사진을 올릴 수 있다');
select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','테스트 활동','설명',pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'))
$$,'회장단은 / 제목·설명·사진을 / 등록할 수 있다');

select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','태그 테스트','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),1,null,array['#MT','mt','체육대회'])
$$,'관리자는 / 중복·대문자 태그를 / 정규화해 저장할 수 있다');
select is((select tags from public.photo_posts where id='a7300000-0000-0000-0000-000000000001'),
 array['mt','체육대회'],'태그는 / 소문자·중복 제거 상태로 / 저장된다');
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from public.photo_posts where tags @> array['체육대회']),1::bigint,'일반 학생은 / 태그로 / 게시물을 조회할 수 있다');
select is((select count(*) from public.photo_posts where tags @> array['없음']),0::bigint,'없는 태그로는 / 다른 게시물이 / 조회되지 않는다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','학생 수정','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),2,null,array['태그'])
$$,'42501',null,'학생은 / RPC로도 / 태그를 수정할 수 없다');
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000001","role":"authenticated"}';
select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','기존 호출','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),2)
$$,'태그 인자 없는 호출은 / 기존 태그를 / 유지한다');
select is((select tags from public.photo_posts where id='a7300000-0000-0000-0000-000000000001'),array['mt','체육대회'],'기존 호출로 / 태그가 / 지워지지 않는다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','긴 태그','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),3,null,array[repeat('가',21)])
$$,'22023',null,'RPC는 / 20자 초과 태그를 / 거부한다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','많은 태그','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),3,null,
 (select array_agg('tag'||n) from generate_series(1,11) n))
$$,'22023',null,'RPC는 / 10개 초과 태그를 / 거부한다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','잘못된 태그','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),3,null,array['<script>'])
$$,'22023',null,'RPC는 / 특수문자 태그를 / 거부한다');
select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','태그 삭제','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),3,null,'{}')
$$,'관리자는 / 태그를 모두 / 지울 수 있다');
select is((select tags from public.photo_posts where id='a7300000-0000-0000-0000-000000000001'),'{}'::text[],'태그 삭제는 / 빈 배열로 / 저장된다');
select * from finish();
rollback;
