-- 회의록 이미지(QA 3차): 회의록·페이지·업무 글·가이드라인에 스크린샷 같은 이미지를 넣는다. 기존 D-7(파일 금지)을 이미지에 한해 푼다.
-- 비공개 저장소 meeting-images, 경로는 "<meeting_id>/<파일 이름>". 한 장 5MB, 이미지 형식만.
--   보기: 그 회의록을 볼 수 있는 사람(can_view_meeting). 화면은 /api/meeting-images/... 를 거쳐 잠깐 쓰는 서명 주소로 연다.
--   올리기: 그 회의록 본문을 고칠 수 있는 사람(can_edit_meeting).
--   지우기: 올린 사람. shortcut: 본문에서 이미지를 지워도 파일은 남는다. 저장 공간이 문제 되면 정리 작업을 추가한다.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-images', 'meeting-images', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

create function private.meeting_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[^/]+$'
    then split_part(p_name, '/', 1)::uuid
  end
$$;

revoke all on function private.meeting_id_from_path(text) from public;
grant execute on function private.meeting_id_from_path(text) to authenticated, service_role;

create policy "meeting images: meeting viewers read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meeting-images'
    and private.can_view_meeting(private.meeting_id_from_path(name))
  );

create policy "meeting images: meeting editors upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'meeting-images'
    and private.can_edit_meeting(private.meeting_id_from_path(name))
  );

create policy "meeting images: uploader delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'meeting-images' and owner_id = (select auth.uid())::text);
