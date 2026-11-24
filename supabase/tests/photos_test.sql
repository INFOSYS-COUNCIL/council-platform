begin;
select no_plan();

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
select is((select position from public.photo_images where post_id='a7300000-0000-0000-0000-000000000001'),1,'첫 사진은 / 대표사진 순서로 / 저장된다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','초과','',
 (select jsonb_agg(value) from generate_series(1,21) cross join jsonb_array_elements(pg_temp.photo_body('a7300000-0000-0000-000000000001'))),1)
$$,'22023',null,'관리자도 / 21장 이상을 / 저장할 수 없다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000002','타 글 이미지','',pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'))
$$,'22023',null,'관리자도 / 타 게시물 사진을 / 재사용할 수 없다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','사진 없음','','[]',1)
$$,'22023',null,'관리자도 / 사진 없이 / 저장할 수 없다');

set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000002","role":"authenticated"}';
select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','국장 수정','변경',pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),1)
$$,'국장은 / 회장단의 글도 / 수정할 수 있다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','오래된 수정','',pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),1)
$$,'40001',null,'관리자는 / 오래된 revision으로 / 덮어쓸 수 없다');

set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from public.photo_posts),1::bigint,'일반 학생은 / 게시된 글을 / 볼 수 있다');
select is((select count(*) from storage.objects where bucket_id='activity-photos'),1::bigint,'일반 학생은 / 게시된 사진을 / 볼 수 있다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','학생 수정','',pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),2)
$$,'42501',null,'일반 학생은 / RPC 직접 호출로도 / 수정할 수 없다');
select throws_ok($$select public.delete_photo_post('a7300000-0000-0000-0000-000000000001')$$,'42501',null,'일반 학생은 / RPC 직접 호출로도 / 삭제할 수 없다');
select throws_ok($$
 insert into storage.objects(bucket_id,name) values ('activity-photos',
 'a7300000-0000-0000-0000-000000000001/f7300000-0000-0000-0000-000000000004/c7300000-0000-0000-0000-000000000002.png')
$$,'42501',null,'일반 학생은 / Storage 직접 호출로도 / 업로드할 수 없다');

set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000003","role":"authenticated"}';
select throws_ok($$select public.save_photo_post('a7300000-0000-0000-0000-000000000002','국원 등록','',pg_temp.photo_body('a7300000-0000-0000-0000-000000000002'))$$,'42501',null,'국원은 / RPC 직접 호출로도 / 등록할 수 없다');
select throws_ok($$select public.delete_photo_post('a7300000-0000-0000-0000-000000000001')$$,'42501',null,'국원은 / RPC 직접 호출로도 / 삭제할 수 없다');

set local role anon;
set local request.jwt.claims='{"role":"anon"}';
select is((select count(*) from storage.objects where bucket_id='activity-photos'),0::bigint,'비로그인은 / 사진 경로를 알아도 / 볼 수 없다');
select throws_ok('select count(*) from public.photo_posts','42501',null,'비로그인은 / 목록을 / 볼 수 없다');

reset role;
update public.terms set status='CLOSED' where id='00000000-0000-0000-0000-000000000001';
insert into public.terms(id,name,status,starts_on,ends_on) values
 ('a7300000-0000-0000-0000-000000000003','다음 테스트 기수','ACTIVE','2027-03-01','2028-02-28');
insert into public.memberships(term_id,user_id,role) values
 ('a7300000-0000-0000-0000-000000000003','f7300000-0000-0000-0000-000000000002','EXECUTIVE');

set local role authenticated;
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from public.photo_posts),1::bigint,'일반 학생은 / 기수 변경 후에도 / 지난 사진을 볼 수 있다');
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000001","role":"authenticated"}';
select throws_ok($$select public.delete_photo_post('a7300000-0000-0000-0000-000000000001')$$,'42501',null,'이전 회장단은 / 현재 소속이 없으면 / 삭제할 수 없다');
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000002","role":"authenticated"}';
reset role;
insert into storage.objects(bucket_id,name) values ('activity-photos',
 'a7300000-0000-0000-0000-000000000001/f7300000-0000-0000-0000-000000000001/c7300000-0000-0000-0000-000000000002.png');
create function pg_temp.photo_two_images() returns jsonb language sql as $$
 select pg_temp.photo_body('a7300000-0000-0000-0000-000000000001') ||
 replace(pg_temp.photo_body('a7300000-0000-0000-0000-000000000001')::text,
 'c7300000-0000-0000-0000-000000000001.png','c7300000-0000-0000-0000-000000000002.png')::jsonb
$$;
set local role authenticated;
select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','썸네일 지정','',pg_temp.photo_two_images(),2,
 '/photos/a7300000-0000-0000-0000-000000000001/images/f7300000-0000-0000-0000-000000000001/c7300000-0000-0000-0000-000000000002.png')
$$,'관리자는 / 두 번째 사진을 / 썸네일로 선택할 수 있다');
select is((select object_path from public.photo_images where post_id='a7300000-0000-0000-0000-000000000001' and position=1),
 'a7300000-0000-0000-0000-000000000001/f7300000-0000-0000-0000-000000000001/c7300000-0000-0000-0000-000000000002.png',
 '선택한 사진이 / 목록용 첫 참조로 / 저장된다');
select is((select body from public.photo_posts where id='a7300000-0000-0000-0000-000000000001'),pg_temp.photo_two_images(),
 '썸네일을 바꿔도 / 상세 본문 사진 순서는 / 유지된다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','없는 썸네일','',
 pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'),3,
 '/photos/a7300000-0000-0000-0000-000000000001/images/f7300000-0000-0000-0000-000000000001/c7300000-0000-0000-0000-000000000002.png')
$$,'22023',null,'저장소에 있어도 / 본문에서 지운 사진은 / 썸네일로 지정할 수 없다');
select throws_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','외부 썸네일','',pg_temp.photo_two_images(),3,'https://example.com/photo.png')
$$,'22023',null,'외부 사진은 / 썸네일로 / 지정할 수 없다');
select lives_ok($$
 select public.save_photo_post('a7300000-0000-0000-0000-000000000001','20장 경계','',
 (select jsonb_agg(value) from generate_series(1,20) cross join jsonb_array_elements(pg_temp.photo_body('a7300000-0000-0000-0000-000000000001'))),3)
$$,'현재 관리자는 / 편집기에서 복제한 사진 블록도 20장까지 / 저장할 수 있다');
select is((select count(*) from public.photo_images where post_id='a7300000-0000-0000-0000-000000000001'),20::bigint,'사진 20장은 / 각각의 순서대로 / 저장된다');
select lives_ok($$select public.delete_photo_post('a7300000-0000-0000-0000-000000000001')$$,'현재 회장단은 / 지난 기수 글도 / 삭제할 수 있다');
select is((select count(*) from public.photo_posts),0::bigint,'삭제 글은 / 목록에서 / 사라진다');
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000004","role":"authenticated"}';
select is((select count(*) from storage.objects where bucket_id='activity-photos'),0::bigint,'삭제 글은 / 학생에게 사진 열람도 / 차단된다');
set local request.jwt.claims='{"sub":"f7300000-0000-0000-0000-000000000002","role":"authenticated"}';
-- Storage API 삭제(remove)는 SELECT와 DELETE 정책을 모두 통과해야 지워진다
set local storage.allow_delete_query = 'true';
delete from storage.objects where bucket_id='activity-photos';
reset role;
select is((select count(*) from storage.objects where bucket_id='activity-photos'),0::bigint,
 '현재 관리자는 / 삭제 글의 사진 파일을 / 저장소에서 정리할 수 있다');
set local role authenticated;
select throws_ok($$
 insert into storage.objects(bucket_id,name) values ('activity-photos',
 'a7300000-0000-0000-0000-000000000001/f7300000-0000-0000-0000-000000000002/c7300000-0000-0000-0000-000000000002.png')
$$,'42501',null,'삭제된 글에는 / 관리자도 / 사진을 올릴 수 없다');

select * from finish();
rollback;
