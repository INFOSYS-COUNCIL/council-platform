-- 카드뉴스(사용 피드백): 국장 이상이 틀(크기·배경·글꼴·요소 배치)을 정하고, 구성원이 그 틀로 카드뉴스를 만들어 PNG·JPEG로 내려받는다.
--   틀(card_templates): 만들기·고치기·지우기는 그 기수 국장 이상. 보기는 그 기수 구성원.
--   카드뉴스(card_news): 만들기는 그 기수 구성원. 고치기·지우기는 만든 사람 또는 국장 이상. 보기는 그 기수 구성원.
--   배치(layouts·slides)는 화면이 쓰는 JSON 그대로 저장한다(요소 위치·글자·크기). 이미지는 브라우저에서 만든다.
--   배경 그림·글꼴 파일은 비공개 저장소 card-assets, 경로 "<term_id>/<파일>". 올리기는 국장 이상, 받기는 그 기수 구성원.

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  name text not null,
  width integer not null default 1080,
  height integer not null default 1350,
  background_color text not null default '#c9d4f5',
  background_path text,
  font_path text,
  layouts jsonb not null default '[]',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint card_templates_name_length check (length(trim(name)) between 1 and 60),
  constraint card_templates_size check (width between 300 and 3000 and height between 300 and 3000),
  constraint card_templates_color check (background_color ~ '^#[0-9a-fA-F]{6}$'),
  constraint card_templates_layouts check (jsonb_typeof(layouts) = 'array' and octet_length(layouts::text) <= 200000)
);

create table public.card_news (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  template_id uuid not null references public.card_templates (id) on delete restrict,
  title text not null,
  slides jsonb not null default '[]',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint card_news_title_length check (length(trim(title)) between 1 and 100),
  constraint card_news_slides check (jsonb_typeof(slides) = 'array' and octet_length(slides::text) <= 500000)
);

create index card_templates_term on public.card_templates (term_id);
create index card_news_term on public.card_news (term_id, updated_at desc);

create trigger card_templates_set_updated_at before update on public.card_templates
  for each row execute function private.set_updated_at();
create trigger card_news_set_updated_at before update on public.card_news
  for each row execute function private.set_updated_at();

alter table public.card_templates enable row level security;
alter table public.card_news enable row level security;
grant select on public.card_templates, public.card_news to authenticated;

create policy "card templates: term members"
  on public.card_templates for select to authenticated
  using (private.is_member(term_id));
create policy "card news: term members"
  on public.card_news for select to authenticated
  using (private.is_member(term_id));

-- 틀 저장(새로 만들기 또는 고치기). p_id가 없으면 새로 만든다
create function public.save_card_template(
  p_id uuid,
  p_term_id uuid,
  p_name text,
  p_width integer,
  p_height integer,
  p_background_color text,
  p_background_path text,
  p_font_path text,
  p_layouts jsonb
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_term uuid := p_term_id;
  v_id uuid;
begin
  if p_id is not null then
    select term_id into v_term from public.card_templates where id = p_id for update;
    if not found then
      raise exception '틀을 찾을 수 없습니다.' using errcode = '42501';
    end if;
  end if;
  if not private.is_director_or_above(v_term) then
    raise exception '국장 이상만 카드뉴스 틀을 만들고 고칠 수 있습니다.' using errcode = '42501';
  end if;
  -- 파일은 그 기수 폴더 안의 것만 쓴다
  if (p_background_path is not null and split_part(p_background_path, '/', 1) <> v_term::text)
     or (p_font_path is not null and split_part(p_font_path, '/', 1) <> v_term::text) then
    raise exception '이 기수에 올린 파일만 쓸 수 있습니다.' using errcode = '22023';
  end if;

  begin
    if p_id is null then
      insert into public.card_templates (term_id, name, width, height, background_color, background_path, font_path, layouts, created_by)
      values (v_term, trim(p_name), p_width, p_height, p_background_color, p_background_path, p_font_path, coalesce(p_layouts, '[]'), (select auth.uid()))
      returning id into v_id;
    else
      update public.card_templates
        set name = trim(p_name), width = p_width, height = p_height, background_color = p_background_color,
            background_path = p_background_path, font_path = p_font_path, layouts = coalesce(p_layouts, '[]')
      where id = p_id
      returning id into v_id;
    end if;
  exception when check_violation then
    raise exception '이름(1~60자), 크기(300~3000px), 배경색, 배치 내용을 확인해 주세요.' using errcode = '23514';
  end;
  return v_id;
end;
$$;

create function public.delete_card_template(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_term uuid;
begin
  select term_id into v_term from public.card_templates where id = p_id for update;
  if not found or not private.is_director_or_above(v_term) then
    raise exception '국장 이상만 틀을 지울 수 있습니다.' using errcode = '42501';
  end if;
  begin
    delete from public.card_templates where id = p_id;
  exception when foreign_key_violation then
    raise exception '이 틀로 만든 카드뉴스가 있어 지울 수 없습니다. 카드뉴스를 먼저 지워 주세요.' using errcode = '55000';
  end;
end;
$$;

-- 카드뉴스 저장. p_id가 없으면 새로 만든다(틀의 기수로)
create function public.save_card_news(p_id uuid, p_template_id uuid, p_title text, p_slides jsonb)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.card_news%rowtype;
  v_term uuid;
  v_id uuid;
begin
  if p_id is null then
    select term_id into v_term from public.card_templates where id = p_template_id;
    if not found or not private.is_member(v_term) then
      raise exception '학생회 구성원만 카드뉴스를 만들 수 있습니다.' using errcode = '42501';
    end if;
    begin
      insert into public.card_news (term_id, template_id, title, slides, created_by)
      values (v_term, p_template_id, trim(p_title), coalesce(p_slides, '[]'), (select auth.uid()))
      returning id into v_id;
    exception when check_violation then
      raise exception '제목(1~100자)과 내용을 확인해 주세요.' using errcode = '23514';
    end;
    return v_id;
  end if;

  select * into v_row from public.card_news where id = p_id for update;
  if not found or not (v_row.created_by = (select auth.uid()) and private.is_member(v_row.term_id)
                       or private.is_director_or_above(v_row.term_id)) then
    raise exception '만든 사람이나 국장 이상만 고칠 수 있습니다.' using errcode = '42501';
  end if;
  begin
    update public.card_news set title = trim(p_title), slides = coalesce(p_slides, '[]') where id = p_id;
  exception when check_violation then
    raise exception '제목(1~100자)과 내용을 확인해 주세요.' using errcode = '23514';
  end;
  return p_id;
end;
$$;

create function public.delete_card_news(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.card_news%rowtype;
begin
  select * into v_row from public.card_news where id = p_id for update;
  if not found or not (v_row.created_by = (select auth.uid()) and private.is_member(v_row.term_id)
                       or private.is_director_or_above(v_row.term_id)) then
    raise exception '만든 사람이나 국장 이상만 지울 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.card_news where id = p_id;
end;
$$;

revoke execute on function
  public.save_card_template(uuid, uuid, text, integer, integer, text, text, text, jsonb),
  public.delete_card_template(uuid),
  public.save_card_news(uuid, uuid, text, jsonb),
  public.delete_card_news(uuid)
from public, anon;
grant execute on function
  public.save_card_template(uuid, uuid, text, integer, integer, text, text, text, jsonb),
  public.delete_card_template(uuid),
  public.save_card_news(uuid, uuid, text, jsonb),
  public.delete_card_news(uuid)
to authenticated;

-- 배경 그림·글꼴 파일 저장소
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-assets', 'card-assets', false, 10485760, array[
  'image/png', 'image/jpeg', 'image/webp',
  'font/otf', 'font/ttf', 'font/woff', 'font/woff2'
]);

create function private.term_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case when p_name ~ '^[0-9a-f-]{36}/[^/]+$' then split_part(p_name, '/', 1)::uuid end
$$;
revoke all on function private.term_id_from_path(text) from public;
grant execute on function private.term_id_from_path(text) to authenticated, service_role;

create policy "card assets: term members read"
  on storage.objects for select to authenticated
  using (bucket_id = 'card-assets' and private.is_member(private.term_id_from_path(name)));
create policy "card assets: directors upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'card-assets' and private.is_director_or_above(private.term_id_from_path(name)));
create policy "card assets: uploader delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'card-assets' and owner_id = (select auth.uid())::text);
