-- #73 활동 사진은 장당 20MiB까지 허용한다. 파일 형식과 장수 제한은 유지한다.
update storage.buckets
set file_size_limit = 20971520
where id = 'activity-photos';
