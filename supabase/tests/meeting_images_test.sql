-- 회의록 이미지 저장소(QA 3차)
-- 실행: npx supabase test db
begin;
select plan(5);

select is(
  private.meeting_id_from_path('11111111-2222-3333-4444-555555555555/a.png'),
  '11111111-2222-3333-4444-555555555555'::uuid,
  '경로 첫 칸이 / 회의록 id다'
);
select is(
  private.meeting_id_from_path('../11111111-2222-3333-4444-555555555555/a.png'),
  null::uuid,
  '형식이 다른 경로는 / 회의록 id가 / 없다'
);
select is(
  (select file_size_limit from storage.buckets where id = 'meeting-images'),
  5242880::bigint,
  '이미지는 / 한 장에 / 5MB까지'
);
select ok(
  (select not public from storage.buckets where id = 'meeting-images'),
  '이미지 저장소는 / 비공개다'
);
select is(
  (select count(*)::int from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'meeting images:%'),
  3,
  '보기·올리기·지우기 / 정책이 / 있다'
);

select * from finish();
rollback;
