-- #73 활동 사진 해시태그. 기존 게시물에는 빈 목록을 사용한다.
create function private.valid_photo_tags(p_tags text[])
returns boolean language sql immutable set search_path = '' as $$
  select p_tags is not null and coalesce(array_ndims(p_tags),1) = 1 and cardinality(p_tags) <= 10
    and not exists (select 1 from unnest(p_tags) t where t is null or length(t) not between 1 and 20
      or t <> lower(t) or t ~ '[^[:alnum:]_-]')
    and cardinality(p_tags) = (select count(distinct t) from unnest(p_tags) t)
$$;
revoke all on function private.valid_photo_tags(text[]) from public;
alter table public.photo_posts add column tags text[] not null default '{}'
  check (private.valid_photo_tags(tags));
create index photo_posts_tags on public.photo_posts using gin(tags) where deleted_at is null;
drop function public.save_photo_post(uuid,text,text,jsonb,integer,text);

create function public.save_photo_post(
  p_post_id uuid,
  p_title text,
  p_description text,
  p_body jsonb,
  p_expected_revision integer default 0,
  p_cover_url text default null,
  p_tags text[] default null
)
returns uuid language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_existing public.photo_posts%rowtype;
  v_term uuid;
  v_image record;
  v_path text;
  v_count integer;
  v_cover_index integer;
  v_seen text[] := '{}';
  v_tags text[];
  v_tag text;
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

  v_tags := coalesce(v_existing.tags, '{}');
  if p_tags is not null then
    if coalesce(array_ndims(p_tags), 1) <> 1 or cardinality(p_tags) > 100 then
      raise exception '해시태그를 확인해 주세요.' using errcode = '22023';
    end if;
    v_tags := '{}';
    foreach v_tag in array p_tags loop
      v_tag := lower(btrim(regexp_replace(v_tag, '^#+', '')));
      if v_tag is null or v_tag = '' then
        raise exception '해시태그를 확인해 주세요.' using errcode = '22023';
      end if;
      if not v_tag = any(v_tags) then v_tags := array_append(v_tags, v_tag); end if;
    end loop;
    if not private.valid_photo_tags(v_tags) then
      raise exception '태그는 최대 10개, 하나당 20자의 글자·숫자·밑줄·하이픈으로 입력해 주세요.' using errcode = '22023';
    end if;
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

  if p_cover_url is not null then
    select ordinal::integer into v_cover_index
      from private.photo_block_images(p_body) where url = p_cover_url order by ordinal limit 1;
    if v_cover_index is null then
      raise exception '본문에 포함된 사진을 썸네일로 선택해 주세요.' using errcode = '22023';
    end if;
    -- 본문 순서는 유지하고, 목록용 참조의 첫 항목만 선택한 사진으로 바꾼다.
    v_seen := array_prepend(v_seen[v_cover_index],
      v_seen[1:v_cover_index - 1] || v_seen[v_cover_index + 1:cardinality(v_seen)]);
  end if;

  if v_existing.id is null then
    select id into v_term from public.terms where status = 'ACTIVE';
    insert into public.photo_posts(id, term_id, title, description, body, tags, created_by)
    values (p_post_id, v_term, trim(p_title), coalesce(p_description, ''), p_body, v_tags, (select auth.uid()));
  else
    update public.photo_posts set title = trim(p_title), description = coalesce(p_description, ''),
      body = p_body, tags = v_tags, revision = revision + 1, updated_at = now() where id = p_post_id;
  end if;
  delete from public.photo_images where post_id = p_post_id;
  insert into public.photo_images(post_id, object_path, position)
    select p_post_id, path, ordinality from unnest(v_seen) with ordinality as images(path, ordinality);
  return p_post_id;
end;
$$;

revoke all on function public.save_photo_post(uuid,text,text,jsonb,integer,text,text[]) from public;
grant execute on function public.save_photo_post(uuid,text,text,jsonb,integer,text,text[]) to authenticated;
