-- #73 활동 사진. 학생 전체 열람, 현재 ACTIVE 기수 국장·회장단만 모든 기수 글 관리.
-- 본문은 기존 페이지와 같은 BlockNote JSON. 첫 이미지가 대표사진이다.
create table public.photo_posts (
  id uuid primary key,
  term_id uuid not null references public.terms(id),
  title text not null check (length(trim(title)) between 1 and 120),
  description text not null default '' check (length(description) <= 1000),
  body jsonb not null check (jsonb_typeof(body) = 'array'),
  revision integer not null default 1 check (revision > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.photo_images (
  post_id uuid not null references public.photo_posts(id),
  object_path text not null,
  position integer not null check (position between 1 and 20),
  primary key (post_id, position)
);
create index photo_images_object_path on public.photo_images(object_path);
create index photo_posts_newest on public.photo_posts (created_at desc, id) where deleted_at is null;
alter table public.photo_posts enable row level security;
alter table public.photo_images enable row level security;

create function private.can_manage_photos()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.terms t
    where t.status = 'ACTIVE' and private.is_director_or_above(t.id)
  )
$$;
revoke all on function private.can_manage_photos() from public;
grant execute on function private.can_manage_photos() to authenticated, service_role;

grant select on public.photo_posts, public.photo_images to authenticated;
grant all on public.photo_posts, public.photo_images to service_role;
create policy "photo posts: logged-in students read" on public.photo_posts
  for select to authenticated using (deleted_at is null and (select auth.uid()) is not null);
create policy "photo images: logged-in students read published references" on public.photo_images
  for select to authenticated using (
    exists (select 1 from public.photo_posts p where p.id = post_id and p.deleted_at is null)
  );

-- 이미지 블록은 children에도 있을 수 있다. BlockNote가 만든 순서대로 깊이 우선 탐색한다.
create function private.photo_block_images(p_body jsonb)
returns table (url text, ordinal bigint)
language sql immutable set search_path = ''
as $$
  with recursive blocks(node, sort_path) as (
    select value, array[ordinality] from jsonb_array_elements(p_body) with ordinality
    union all
    select c.value, b.sort_path || c.ordinality
    from blocks b cross join lateral jsonb_array_elements(
      case when jsonb_typeof(b.node -> 'children') = 'array' then b.node -> 'children' else '[]'::jsonb end
    ) with ordinality c
  )
  select node #>> '{props,url}', row_number() over (order by sort_path)
  from blocks where node ->> 'type' = 'image'
$$;
revoke all on function private.photo_block_images(jsonb) from public;

-- /photos/<post>/images/<uploader>/<file> 은 앱의 인증된 이미지 진입 주소.
-- 버킷 경로는 <post>/<uploader>/<file>. 잘못된 경로는 UUID 변환 전에 거부한다.
create function private.photo_post_id_from_path(p_path text)
returns uuid language sql immutable set search_path = ''
as $$
  select case when p_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]{36}\.(png|jpg|webp)$'
    then split_part(p_path, '/', 1)::uuid end
$$;
revoke all on function private.photo_post_id_from_path(text) from public;
grant execute on function private.photo_post_id_from_path(text) to authenticated, service_role;

create function private.can_read_photo_image(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null
    and private.photo_post_id_from_path(p_path) is not null
    and (
      exists (
        select 1 from public.photo_images i join public.photo_posts p on p.id = i.post_id
        where i.object_path = p_path and p.deleted_at is null
      )
      or (
        private.can_manage_photos()
        and split_part(p_path, '/', 2) = (select auth.uid())::text
        and not exists (
          select 1 from public.photo_posts p
          where p.id = private.photo_post_id_from_path(p_path) and p.deleted_at is not null
        )
      )
    )
$$;
revoke all on function private.can_read_photo_image(text) from public;
grant execute on function private.can_read_photo_image(text) to authenticated, service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('activity-photos', 'activity-photos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);

create policy "activity photos: authorized image readers" on storage.objects
  for select to authenticated
  using (bucket_id = 'activity-photos' and private.can_read_photo_image(name));
create function private.can_upload_photo_image(p_path text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_manage_photos()
    and private.photo_post_id_from_path(p_path) is not null
    and split_part(p_path, '/', 2) = (select auth.uid())::text
    and not exists (
      select 1 from public.photo_posts p
      where p.id = private.photo_post_id_from_path(p_path) and p.deleted_at is not null
    )
$$;
revoke all on function private.can_upload_photo_image(text) from public;
grant execute on function private.can_upload_photo_image(text) to authenticated, service_role;

create policy "activity photos: current managers upload" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'activity-photos'
    and private.can_upload_photo_image(name)
  );
-- 저장된 사진을 Storage API로 직접 지워 게시물을 깨뜨릴 수 없게 한다.
create policy "activity photos: managers remove unused uploads" on storage.objects
  for delete to authenticated using (
    bucket_id = 'activity-photos' and private.can_manage_photos()
    and not exists (
      select 1 from public.photo_images i join public.photo_posts p on p.id = i.post_id
      where i.object_path = name and p.deleted_at is null
    )
  );

create function public.save_photo_post(
  p_post_id uuid,
  p_title text,
  p_description text,
  p_body jsonb,
  p_expected_revision integer default 0
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_existing public.photo_posts%rowtype;
  v_term uuid;
  v_image record;
  v_path text;
  v_count integer;
  v_seen text[] := '{}';
begin
  if not private.can_manage_photos() then
    raise exception '활동 사진은 현재 기수 국장·회장단만 관리할 수 있습니다.' using errcode = '42501';
  end if;
  if p_post_id is null or p_expected_revision is null then
    raise exception '게시물 정보를 확인해 주세요.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_title, ''))) not between 1 and 120
     or length(coalesce(p_description, '')) > 1000 then
    raise exception '제목은 1~120자, 설명은 1000자까지 입력해 주세요.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_body) is distinct from 'array' or octet_length(p_body::text) > 524288 then
    raise exception '본문 형식이나 크기를 확인해 주세요.' using errcode = '22023';
  end if;
  select count(*) into v_count from private.photo_block_images(p_body);
  if v_count not between 1 and 20 then
    raise exception '사진은 게시물마다 1~20장 넣어 주세요.' using errcode = '22023';
  end if;

  -- 최초 생성 경쟁과 같은 revision의 동시 수정을 모두 직렬화한다.
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text, 73));
  select * into v_existing from public.photo_posts where id = p_post_id for update;
  if found then
    if v_existing.deleted_at is not null then
      raise exception '삭제된 게시물입니다.' using errcode = '55000';
    end if;
    if v_existing.revision <> p_expected_revision then
      raise exception '다른 관리자가 수정했습니다. 새로고침한 뒤 다시 확인해 주세요.' using errcode = '40001';
    end if;
  elsif p_expected_revision <> 0 then
    raise exception '게시물을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  for v_image in select * from private.photo_block_images(p_body) loop
    v_path := replace(v_image.url, '/photos/' || p_post_id::text || '/images/', p_post_id::text || '/');
    if v_image.url is null
       or v_image.url not like '/photos/' || p_post_id::text || '/images/%'
       or private.photo_post_id_from_path(v_path) is distinct from p_post_id
       or not exists (select 1 from storage.objects where bucket_id = 'activity-photos' and name = v_path) then
      raise exception '이 게시물에 올린 사진만 사용할 수 있습니다. 사진을 다시 선택해 주세요.' using errcode = '22023';
    end if;
    v_seen := array_append(v_seen, v_path);
  end loop;

  if v_existing.id is null then
    select id into v_term from public.terms where status = 'ACTIVE';
    insert into public.photo_posts(id, term_id, title, description, body, created_by)
    values (p_post_id, v_term, trim(p_title), coalesce(p_description, ''), p_body, (select auth.uid()));
  else
    update public.photo_posts set title = trim(p_title), description = coalesce(p_description, ''),
      body = p_body, revision = revision + 1, updated_at = now() where id = p_post_id;
  end if;
  delete from public.photo_images where post_id = p_post_id;
  insert into public.photo_images(post_id, object_path, position)
    select p_post_id, path, ordinality from unnest(v_seen) with ordinality as images(path, ordinality);
  return p_post_id;
end;
$$;

create function public.delete_photo_post(p_post_id uuid)
returns void language plpgsql volatile security definer set search_path = ''
as $$
begin
  if not private.can_manage_photos() then
    raise exception '활동 사진은 현재 기수 국장·회장단만 관리할 수 있습니다.' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_post_id::text, 73));
  update public.photo_posts set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where id = p_post_id;
  if not found then
    raise exception '게시물을 찾을 수 없습니다.' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.save_photo_post(uuid,text,text,jsonb,integer), public.delete_photo_post(uuid) from public;
grant execute on function public.save_photo_post(uuid,text,text,jsonb,integer), public.delete_photo_post(uuid) to authenticated;
