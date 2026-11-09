-- 일정(Schedule)·바로가기(Quick Links)
-- 기준: 기획서 v0.8 3.2·5.4·5.6절
-- 쓰기는 모두 아래 함수로만 한다.
-- shortcut: 기수 공통 일정은 국장·회장단이 만들고, 만든 사람과 회장단이 지운다. 수정 함수는 아직 없다(지우고 다시 만든다). 수정 화면을 만들 때 update_schedule을 추가한다.

-- ---------------------------------------------------------------------
-- 1. 일정 (5.4절): 기수 공통 또는 행사 일정. 종일 일정은 날짜로, 시간 일정은 timestamptz로
-- ---------------------------------------------------------------------
create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  event_id uuid,
  title text not null,
  description text not null default '',
  location text not null default '',
  is_all_day boolean not null,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint schedules_title_length check (length(trim(title)) between 1 and 100),
  constraint schedules_text_length check (length(description) <= 2000 and length(location) <= 100),
  constraint schedules_time_shape check (
    (is_all_day and start_date is not null and end_date is not null and start_date <= end_date
       and starts_at is null and ends_at is null)
    or (not is_all_day and starts_at is not null and ends_at is not null and starts_at <= ends_at
       and start_date is null and end_date is null)
  ),
  constraint schedules_event_same_term foreign key (term_id, event_id)
    references public.events (term_id, id) on delete cascade
);

create index schedules_term_time on public.schedules (term_id, coalesce(start_date, (starts_at at time zone 'Asia/Seoul')::date));
create index schedules_event on public.schedules (event_id) where event_id is not null;

create trigger schedules_set_updated_at
  before update on public.schedules
  for each row execute function private.set_updated_at();

-- 열람: 기수 공통은 그 기수 활성 구성원, 행사 일정은 행사 열람 범위를 따른다
create function private.can_view_schedule_values(p_term_id uuid, p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_event_id is null then private.is_member(p_term_id)
    else private.can_view_event(p_event_id)
  end
$$;

revoke all on function private.can_view_schedule_values(uuid, uuid) from public;
grant execute on function private.can_view_schedule_values(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2. 바로가기 (3.2절): 기수와 무관한 전역 설정. 열람은 ACTIVE 기수 구성원, 관리는 그 회장단
-- ---------------------------------------------------------------------
create table public.dashboard_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  description text not null default '',
  icon_key text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint dashboard_links_name_length check (length(trim(name)) between 1 and 50),
  constraint dashboard_links_description_length check (length(description) <= 200),
  constraint dashboard_links_https check (url ~ '^https://[^\s]+$')
);

create function private.active_term_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.terms where status = 'ACTIVE'
$$;

revoke all on function private.active_term_id() from public;
grant execute on function private.active_term_id() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. RLS: 읽기만 허용한다
-- ---------------------------------------------------------------------
alter table public.schedules enable row level security;
alter table public.dashboard_links enable row level security;

grant select on public.schedules, public.dashboard_links to authenticated;

create policy "schedules: term members or event viewers"
  on public.schedules for select
  to authenticated
  using (private.can_view_schedule_values(term_id, event_id));

-- 비활성 링크는 관리하는 회장단만 본다
create policy "dashboard links: active term members"
  on public.dashboard_links for select
  to authenticated
  using (
    (is_active and private.is_member(private.active_term_id()))
    or private.is_executive(private.active_term_id())
  );

-- ---------------------------------------------------------------------
-- 4. 일정 쓰기 함수 (5.6절)
-- ---------------------------------------------------------------------
create function public.create_schedule(
  p_term_id uuid,
  p_event_id uuid,
  p_title text,
  p_is_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date date,
  p_location text default '',
  p_description text default ''
)
returns public.schedules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_event public.events%rowtype;
  v_row public.schedules%rowtype;
begin
  if p_event_id is null then
    select cm.role into v_role from private.current_membership(p_term_id) cm;
    if v_role is null or v_role = 'MEMBER' then
      raise exception '국장과 회장단만 기수 일정을 만들 수 있습니다.' using errcode = '42501';
    end if;
  else
    v_event := private.lock_visible_event(p_event_id);
    if v_event.term_id is distinct from p_term_id then
      raise exception '행사를 찾을 수 없습니다.' using errcode = '42501';
    end if;
    perform private.require_manage_event(v_event);
  end if;

  begin
    insert into public.schedules (
      term_id, event_id, title, description, location, is_all_day,
      starts_at, ends_at, start_date, end_date, created_by)
    values (
      p_term_id, p_event_id, trim(p_title), coalesce(p_description, ''), coalesce(trim(p_location), ''),
      coalesce(p_is_all_day, false),
      case when not coalesce(p_is_all_day, false) then p_starts_at end,
      case when not coalesce(p_is_all_day, false) then p_ends_at end,
      case when coalesce(p_is_all_day, false) then p_start_date end,
      case when coalesce(p_is_all_day, false) then p_end_date end,
      (select auth.uid()))
    returning * into v_row;
  exception when check_violation then
    raise exception '제목(1~100자)과 시작·종료(종일이면 날짜, 아니면 시각)를 확인해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

create function public.delete_schedule(p_schedule_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.schedules%rowtype;
begin
  select * into v_row from public.schedules where id = p_schedule_id for update;
  if not found or not private.can_view_schedule_values(v_row.term_id, v_row.event_id) then
    raise exception '일정을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  if v_row.created_by is distinct from (select auth.uid())
     and not private.is_executive(v_row.term_id)
     and not (v_row.event_id is not null and exists (
       select 1 from public.events e where e.id = v_row.event_id and private.can_manage_event(e))) then
    raise exception '만든 사람이나 관리 권한이 있는 사람만 지울 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.schedules where id = p_schedule_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 바로가기 쓰기 함수: ACTIVE 기수 회장단만
-- ---------------------------------------------------------------------
create function private.require_active_executive()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_executive(private.active_term_id()) then
    raise exception '회장단만 바로가기를 관리할 수 있습니다.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.require_active_executive() from public;

create function public.create_dashboard_link(
  p_name text,
  p_url text,
  p_description text default '',
  p_sort_order integer default 0
)
returns public.dashboard_links
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.dashboard_links%rowtype;
begin
  perform private.require_active_executive();
  begin
    insert into public.dashboard_links (name, url, description, sort_order)
    values (trim(p_name), trim(p_url), coalesce(p_description, ''), coalesce(p_sort_order, 0))
    returning * into v_row;
  exception when check_violation then
    raise exception '이름(1~50자)과 https:// 로 시작하는 주소를 확인해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

create function public.set_dashboard_link_active(p_link_id uuid, p_active boolean)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_active_executive();
  update public.dashboard_links set is_active = coalesce(p_active, true) where id = p_link_id;
  if not found then
    raise exception '바로가기를 찾을 수 없습니다.' using errcode = '42501';
  end if;
end;
$$;

create function public.delete_dashboard_link(p_link_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform private.require_active_executive();
  delete from public.dashboard_links where id = p_link_id;
  if not found then
    raise exception '바로가기를 찾을 수 없습니다.' using errcode = '42501';
  end if;
end;
$$;

revoke all on function
  public.create_schedule(uuid, uuid, text, boolean, timestamptz, timestamptz, date, date, text, text),
  public.delete_schedule(uuid),
  public.create_dashboard_link(text, text, text, integer),
  public.set_dashboard_link_active(uuid, boolean),
  public.delete_dashboard_link(uuid)
from public, anon;

grant execute on function
  public.create_schedule(uuid, uuid, text, boolean, timestamptz, timestamptz, date, date, text, text),
  public.delete_schedule(uuid),
  public.create_dashboard_link(text, text, text, integer),
  public.set_dashboard_link_active(uuid, boolean),
  public.delete_dashboard_link(uuid)
to authenticated;
