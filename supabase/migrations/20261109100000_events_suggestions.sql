-- 행사(Event)·행사 자료·건의(Suggestion)
-- 기준: 기획서 v0.8 5.1~5.3·5.6·7장, 부록 C.1 D-9~D-13·D-15 (제안값으로 구현, 회장단 확정 필요)
-- 쓰기는 모두 아래 함수로만 한다. 테이블에 직접 insert·update·delete 권한은 주지 않는다.
-- shortcut: 5.2절 "범위 축소 시 충돌 처리"와 Task·Meeting의 event_id 연결은 아직 없다. 업무를 행사에 연결할 때 함께 만든다.

-- ---------------------------------------------------------------------
-- 1. 타입
-- ---------------------------------------------------------------------
create type public.event_status as enum ('PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED');   -- D-15
create type public.event_visibility as enum ('ALL_COUNCIL', 'RESTRICTED');
create type public.event_resource_type as enum ('UPLOAD', 'EXTERNAL_LINK');
create type public.suggestion_status as enum ('RECEIVED', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
create type public.suggestion_message_type as enum ('AUTHOR_VISIBLE', 'INTERNAL');

-- ---------------------------------------------------------------------
-- 2. 행사
-- ---------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  owner_department_id uuid not null,
  name text not null,
  description text not null default '',
  status public.event_status not null default 'PLANNING',
  manager_id uuid not null references public.profiles (id) on delete restrict,
  visibility_mode public.event_visibility not null default 'ALL_COUNCIL',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_name_length check (length(trim(name)) between 1 and 100),
  constraint events_description_length check (length(description) <= 10000),
  constraint events_time_order check (starts_at is null or ends_at is null or starts_at <= ends_at),
  constraint events_department_same_term foreign key (term_id, owner_department_id)
    references public.departments (term_id, id) on delete restrict,
  constraint events_term_id_id_key unique (term_id, id)
);

create index events_term_status on public.events (term_id, status);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function private.set_updated_at();

create table public.event_access_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  term_id uuid not null,
  subject_type public.acl_subject_type not null,
  department_id uuid,
  user_id uuid references public.profiles (id) on delete restrict,
  role_group public.acl_role_group,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint event_access_subject_shape check (
    (subject_type = 'DEPARTMENT' and department_id is not null and user_id is null and role_group is null)
    or (subject_type = 'USER' and user_id is not null and department_id is null and role_group is null)
    or (subject_type = 'ROLE_GROUP' and role_group is not null and department_id is null and user_id is null)
  ),
  constraint event_access_unique_subject unique nulls not distinct
    (event_id, subject_type, department_id, user_id, role_group),
  constraint event_access_event_same_term foreign key (term_id, event_id)
    references public.events (term_id, id) on delete cascade,
  constraint event_access_department_same_term foreign key (term_id, department_id)
    references public.departments (term_id, id) on delete restrict
);

create index event_access_rules_event on public.event_access_rules (event_id);

create table public.event_resources (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null,
  term_id uuid not null,
  resource_type public.event_resource_type not null,
  title text not null,
  description text not null default '',
  storage_path text,
  size_bytes bigint,
  external_url text,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint event_resources_title_length check (length(trim(title)) between 1 and 100),
  constraint event_resources_description_length check (length(description) <= 1000),
  constraint event_resources_shape check (
    (resource_type = 'UPLOAD' and storage_path is not null and external_url is null)
    or (resource_type = 'EXTERNAL_LINK' and external_url ~ '^https://[^\s]+$' and storage_path is null)
  ),
  constraint event_resources_path_unique unique (storage_path),
  constraint event_resources_event_same_term foreign key (term_id, event_id)
    references public.events (term_id, id) on delete restrict
);

create index event_resources_event on public.event_resources (event_id, created_at desc);

-- 활동 기록 대상에 행사·건의를 더한다
alter table public.activity_logs drop constraint activity_logs_resource_type_check;
alter table public.activity_logs add constraint activity_logs_resource_type_check
  check (resource_type in ('TASK', 'MEMBERSHIP', 'EVENT', 'SUGGESTION'));

-- ---------------------------------------------------------------------
-- 3. 행사 권한 판정 (5.2·5.6절)
-- ---------------------------------------------------------------------
create function private.can_view_event_values(
  p_event_id uuid,
  p_term_id uuid,
  p_owner_department_id uuid,
  p_created_by uuid,
  p_manager_id uuid,
  p_visibility public.event_visibility
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.current_membership(p_term_id) cm
    where p_visibility = 'ALL_COUNCIL'
      or cm.role = 'EXECUTIVE'
      or (select auth.uid()) in (p_created_by, p_manager_id)
      or cm.department_id = p_owner_department_id
      or exists (
        select 1 from public.event_access_rules r
        where r.event_id = p_event_id
          and (
            (r.subject_type = 'USER' and r.user_id = (select auth.uid()))
            or (r.subject_type = 'DEPARTMENT' and r.department_id = cm.department_id)
            or (r.subject_type = 'ROLE_GROUP' and (
              r.role_group = 'ALL_COUNCIL'
              or (r.role_group = 'DIRECTORS' and cm.role in ('DIRECTOR', 'EXECUTIVE'))
              or (r.role_group = 'EXECUTIVES' and cm.role = 'EXECUTIVE')
            ))
          )
      )
  )
$$;

create function private.can_view_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.can_view_event_values(
      e.id, e.term_id, e.owner_department_id, e.created_by, e.manager_id, e.visibility_mode)
    from public.events e
    where e.id = p_event_id
  ), false)
$$;

-- "관리하는 Event": 회장단은 같은 기수 전체, 국장은 자기 국 행사이거나 자신이 관리자인 행사
create function private.can_manage_event(p_event public.events)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.current_membership(p_event.term_id) cm
    where cm.role = 'EXECUTIVE'
      or (cm.role = 'DIRECTOR' and (
        p_event.owner_department_id = cm.department_id
        or p_event.manager_id = (select auth.uid())
      ))
  )
$$;

create function private.lock_visible_event(p_event_id uuid)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or not private.can_view_event(p_event_id) then
    raise exception '행사를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  return v_event;
end;
$$;

create function private.require_manage_event(p_event public.events)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_event(p_event) then
    raise exception '이 행사를 관리할 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_event.status = 'ARCHIVED' then
    raise exception '보관된 행사는 바꿀 수 없습니다.' using errcode = '55000';
  end if;
end;
$$;

-- Storage 경로 "<term_id>/<event_id>/<파일>"에서 행사 id를 꺼낸다. 형식이 다르면 null.
create function private.event_id_from_path(p_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[^/]+$'
    then split_part(p_name, '/', 2)::uuid
  end
$$;

revoke all on function
  private.can_view_event_values(uuid, uuid, uuid, uuid, uuid, public.event_visibility),
  private.can_view_event(uuid),
  private.can_manage_event(public.events),
  private.lock_visible_event(uuid),
  private.require_manage_event(public.events),
  private.event_id_from_path(text)
from public;

grant execute on function
  private.can_view_event_values(uuid, uuid, uuid, uuid, uuid, public.event_visibility),
  private.can_view_event(uuid),
  private.can_manage_event(public.events),
  private.event_id_from_path(text)
to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 4. 건의 (7장). 작성자 신원은 suggestion_authors에만 둔다(7.1절)
-- ---------------------------------------------------------------------
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  title text not null,
  content text not null,
  status public.suggestion_status not null default 'RECEIVED',
  assigned_department_id uuid,
  assigned_user_id uuid references public.profiles (id) on delete restrict,
  resolved_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint suggestions_title_length check (length(trim(title)) between 1 and 100),       -- D-13
  constraint suggestions_content_length check (length(trim(content)) between 1 and 3000), -- D-13
  constraint suggestions_withdrawn_closed check (withdrawn_at is null or status = 'CLOSED'),
  constraint suggestions_department_same_term foreign key (term_id, assigned_department_id)
    references public.departments (term_id, id) on delete restrict
);

create index suggestions_term_status on public.suggestions (term_id, status, created_at desc);

create trigger suggestions_set_updated_at
  before update on public.suggestions
  for each row execute function private.set_updated_at();

create table public.suggestion_authors (
  suggestion_id uuid primary key references public.suggestions (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete restrict,
  request_id uuid not null,
  -- 같은 요청이 두 번 들어와도 건의는 하나만 생긴다
  constraint suggestion_authors_request_key unique (author_user_id, request_id)
);

create index suggestion_authors_author on public.suggestion_authors (author_user_id);

create table public.suggestion_messages (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references public.suggestions (id) on delete cascade,
  message_type public.suggestion_message_type not null,
  body text not null,
  writer_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint suggestion_messages_body_length check (length(trim(body)) between 1 and 3000)
);

create index suggestion_messages_suggestion on public.suggestion_messages (suggestion_id, created_at);

-- 작성자 본인인지. 참/거짓만 돌려주고 작성자 id는 내보내지 않는다(7.2절)
create function private.is_suggestion_author(p_suggestion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.suggestion_authors a
    where a.suggestion_id = p_suggestion_id and a.author_user_id = (select auth.uid())
  )
$$;

-- 처리자: 회장단, 직접 배정된 사람, 배정 부서의 활성 국장(D-11)
create function private.is_suggestion_handler_values(
  p_term_id uuid,
  p_assigned_department_id uuid,
  p_assigned_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.current_membership(p_term_id) cm
    where cm.role = 'EXECUTIVE'
      or p_assigned_user_id = (select auth.uid())
      or (cm.role = 'DIRECTOR' and cm.department_id = p_assigned_department_id)
  )
$$;

create function private.is_suggestion_handler(p_suggestion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.is_suggestion_handler_values(s.term_id, s.assigned_department_id, s.assigned_user_id)
    from public.suggestions s
    where s.id = p_suggestion_id
  ), false)
$$;

revoke all on function
  private.is_suggestion_author(uuid),
  private.is_suggestion_handler_values(uuid, uuid, uuid),
  private.is_suggestion_handler(uuid)
from public;

grant execute on function
  private.is_suggestion_author(uuid),
  private.is_suggestion_handler_values(uuid, uuid, uuid),
  private.is_suggestion_handler(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 5. 테이블 권한과 RLS: 읽기만 허용한다
-- ---------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_access_rules enable row level security;
alter table public.event_resources enable row level security;
alter table public.suggestions enable row level security;
alter table public.suggestion_authors enable row level security;
alter table public.suggestion_messages enable row level security;

grant select on
  public.events, public.event_access_rules, public.event_resources,
  public.suggestions, public.suggestion_authors, public.suggestion_messages
to authenticated;

create policy "events: viewers"
  on public.events for select
  to authenticated
  using (private.can_view_event_values(
    id, term_id, owner_department_id, created_by, manager_id, visibility_mode));

create policy "event access rules: event viewers"
  on public.event_access_rules for select
  to authenticated
  using (private.can_view_event(event_id));

create policy "event resources: event viewers"
  on public.event_resources for select
  to authenticated
  using (private.can_view_event(event_id));

create policy "suggestions: author or handler"
  on public.suggestions for select
  to authenticated
  using (
    private.is_suggestion_author(id)
    or private.is_suggestion_handler_values(term_id, assigned_department_id, assigned_user_id)
  );

-- 신원은 본인과 그 기수 회장단만 (7.1절)
create policy "suggestion authors: self or executives"
  on public.suggestion_authors for select
  to authenticated
  using (
    author_user_id = (select auth.uid())
    or exists (
      select 1 from public.suggestions s
      where s.id = suggestion_id and private.is_executive(s.term_id)
    )
  );

-- 내부 메모는 처리자만, 공개 답변은 작성자도 (7.2절)
create policy "suggestion messages: by type"
  on public.suggestion_messages for select
  to authenticated
  using (
    private.is_suggestion_handler(suggestion_id)
    or (message_type = 'AUTHOR_VISIBLE' and private.is_suggestion_author(suggestion_id))
  );

drop policy "activity logs: resource viewers or executives" on public.activity_logs;
create policy "activity logs: resource viewers or executives"
  on public.activity_logs for select
  to authenticated
  using (
    private.is_executive(term_id)
    or (resource_type = 'TASK' and private.can_view_task(resource_id))
    or (resource_type = 'EVENT' and private.can_view_event(resource_id))
  );

-- ---------------------------------------------------------------------
-- 6. 행사 자료 Storage (5.3절): 비공개 Bucket, 10MB, 허용 형식만
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-files', 'event-files', false, 10485760,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/x-hwp', 'application/vnd.hancom.hwpx'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 올리기·내려받기: 그 행사를 볼 수 있는 사람. 경로의 기수·행사가 실제 행 값과 맞아야 한다
-- 하위 쿼리 안에서는 events.name과 겹치지 않도록 파일 경로를 objects.name으로 적는다
create policy "event files: event viewers read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-files'
    and private.can_view_event(private.event_id_from_path(name))
  );

create policy "event files: event viewers upload"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-files'
    and exists (
      select 1 from public.events e
      where e.id = private.event_id_from_path(objects.name)
        and e.term_id::text = split_part(objects.name, '/', 1)
        and e.status <> 'ARCHIVED'
        and private.can_view_event(e.id)
    )
  );

-- 삭제: 올린 사람이나 행사 관리자
create policy "event files: owner or manager delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-files'
    and (
      owner_id = (select auth.uid())::text
      or exists (
        select 1 from public.events e
        where e.id = private.event_id_from_path(objects.name) and private.can_manage_event(e)
      )
    )
  );

-- ---------------------------------------------------------------------
-- 7. 행사 쓰기 함수 (5.6절 권한표)
-- ---------------------------------------------------------------------
create function public.create_event(
  p_term_id uuid,
  p_owner_department_id uuid,
  p_name text,
  p_description text default '',
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_visibility_mode public.event_visibility default 'ALL_COUNCIL'
)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_dept uuid;
  v_event public.events%rowtype;
begin
  select cm.role, cm.department_id into v_role, v_dept
  from private.current_membership(p_term_id) cm;

  if v_role is null or v_role = 'MEMBER' then
    raise exception '국장과 회장단만 행사를 만들 수 있습니다.' using errcode = '42501';
  end if;
  if v_role = 'DIRECTOR' and p_owner_department_id is distinct from v_dept then
    raise exception '국장은 자기 국 행사만 만들 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.departments d
    where d.id = p_owner_department_id and d.term_id = p_term_id and d.is_active
  ) then
    raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
  end if;

  begin
    insert into public.events (
      term_id, owner_department_id, name, description, manager_id, created_by,
      starts_at, ends_at, visibility_mode)
    values (
      p_term_id, p_owner_department_id, trim(p_name), coalesce(p_description, ''),
      (select auth.uid()), (select auth.uid()), p_starts_at, p_ends_at,
      coalesce(p_visibility_mode, 'ALL_COUNCIL'))
    returning * into v_event;
  exception when check_violation then
    raise exception '이름(1~100자), 설명(10,000자 이하), 시작·종료 순서를 확인해 주세요.' using errcode = '23514';
  end;

  perform private.log_activity(p_term_id, 'EVENT', v_event.id, 'CREATE', null,
    jsonb_build_object('name', v_event.name, 'visibility_mode', v_event.visibility_mode));
  return v_event;
end;
$$;

create function public.update_event(
  p_event_id uuid,
  p_name text,
  p_description text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_manager_id uuid
)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.events%rowtype := private.lock_visible_event(p_event_id);
  v_new public.events%rowtype;
begin
  perform private.require_manage_event(v_old);
  if p_manager_id is null or not private.is_active_member_of(v_old.term_id, p_manager_id) then
    raise exception '관리자는 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;

  begin
    update public.events
      set name = trim(p_name), description = coalesce(p_description, ''),
          starts_at = p_starts_at, ends_at = p_ends_at, manager_id = p_manager_id
    where id = p_event_id
    returning * into v_new;
  exception when check_violation then
    raise exception '이름(1~100자), 설명(10,000자 이하), 시작·종료 순서를 확인해 주세요.' using errcode = '23514';
  end;

  perform private.log_activity(v_new.term_id, 'EVENT', v_new.id,
    case when v_old.manager_id is distinct from v_new.manager_id then 'MANAGER_CHANGE' else 'UPDATE' end,
    jsonb_build_object('name', v_old.name, 'manager_id', v_old.manager_id),
    jsonb_build_object('name', v_new.name, 'manager_id', v_new.manager_id));
  return v_new;
end;
$$;

-- D-15: PLANNING→ACTIVE→COMPLETED→ARCHIVED 순서대로 한 단계씩. 되돌리기는 한 단계씩, ARCHIVED 해제는 회장단만
create function public.change_event_status(p_event_id uuid, p_status public.event_status)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.events%rowtype := private.lock_visible_event(p_event_id);
  v_new public.events%rowtype;
  v_order public.event_status[] := array['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']::public.event_status[];
  v_from integer;
  v_to integer;
begin
  if not private.can_manage_event(v_old) then
    raise exception '이 행사를 관리할 권한이 없습니다.' using errcode = '42501';
  end if;
  v_from := array_position(v_order, v_old.status);
  v_to := array_position(v_order, p_status);
  if v_to is null or abs(v_to - v_from) <> 1 then
    raise exception '행사 상태는 한 단계씩만 바꿀 수 있습니다.' using errcode = '55000';
  end if;
  if v_old.status = 'ARCHIVED' and not private.is_executive(v_old.term_id) then
    raise exception '보관된 행사는 회장단만 되돌릴 수 있습니다.' using errcode = '42501';
  end if;

  update public.events set status = p_status where id = p_event_id returning * into v_new;
  perform private.log_activity(v_new.term_id, 'EVENT', v_new.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_old.status), jsonb_build_object('status', v_new.status));
  return v_new;
end;
$$;

create function public.set_event_visibility(p_event_id uuid, p_mode public.event_visibility)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.events%rowtype := private.lock_visible_event(p_event_id);
  v_new public.events%rowtype;
begin
  perform private.require_manage_event(v_old);
  if p_mode is null or p_mode = v_old.visibility_mode then
    return v_old;
  end if;
  update public.events set visibility_mode = p_mode where id = p_event_id returning * into v_new;
  perform private.log_activity(v_new.term_id, 'EVENT', v_new.id, 'VISIBILITY_CHANGE',
    jsonb_build_object('visibility_mode', v_old.visibility_mode),
    jsonb_build_object('visibility_mode', v_new.visibility_mode));
  return v_new;
end;
$$;

create function public.add_event_access_rule(
  p_event_id uuid,
  p_subject_type public.acl_subject_type,
  p_department_id uuid default null,
  p_user_id uuid default null,
  p_role_group public.acl_role_group default null
)
returns public.event_access_rules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype := private.lock_visible_event(p_event_id);
  v_rule public.event_access_rules%rowtype;
begin
  perform private.require_manage_event(v_event);
  if p_subject_type = 'USER' and not private.is_active_member_of(v_event.term_id, p_user_id) then
    raise exception '열람 대상은 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;

  begin
    insert into public.event_access_rules (
      event_id, term_id, subject_type, department_id, user_id, role_group, granted_by)
    values (
      p_event_id, v_event.term_id, p_subject_type,
      case when p_subject_type = 'DEPARTMENT' then p_department_id end,
      case when p_subject_type = 'USER' then p_user_id end,
      case when p_subject_type = 'ROLE_GROUP' then p_role_group end,
      (select auth.uid()))
    returning * into v_rule;
  exception
    when unique_violation then
      raise exception '이미 추가한 열람 대상입니다.' using errcode = '23505';
    when check_violation or foreign_key_violation then
      raise exception '열람 대상을 확인해 주세요.' using errcode = '22023';
  end;

  perform private.log_activity(v_event.term_id, 'EVENT', v_event.id, 'ACL_ADD', null,
    jsonb_build_object('subject_type', v_rule.subject_type, 'department_id', v_rule.department_id,
      'user_id', v_rule.user_id, 'role_group', v_rule.role_group));
  return v_rule;
end;
$$;

create function public.remove_event_access_rule(p_rule_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rule public.event_access_rules%rowtype;
  v_event public.events%rowtype;
begin
  select * into v_rule from public.event_access_rules where id = p_rule_id;
  if not found then
    raise exception '열람 대상을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  v_event := private.lock_visible_event(v_rule.event_id);
  perform private.require_manage_event(v_event);

  delete from public.event_access_rules where id = p_rule_id;
  perform private.log_activity(v_event.term_id, 'EVENT', v_event.id, 'ACL_REMOVE',
    jsonb_build_object('subject_type', v_rule.subject_type, 'department_id', v_rule.department_id,
      'user_id', v_rule.user_id, 'role_group', v_rule.role_group), null);
end;
$$;

-- 자료 등록: 행사를 볼 수 있는 사람 (5.6절)
create function public.add_event_link(
  p_event_id uuid,
  p_title text,
  p_url text,
  p_description text default ''
)
returns public.event_resources
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype := private.lock_visible_event(p_event_id);
  v_resource public.event_resources%rowtype;
begin
  if v_event.status = 'ARCHIVED' then
    raise exception '보관된 행사에는 자료를 추가할 수 없습니다.' using errcode = '55000';
  end if;
  begin
    insert into public.event_resources (event_id, term_id, resource_type, title, description, external_url, uploaded_by)
    values (p_event_id, v_event.term_id, 'EXTERNAL_LINK', trim(p_title), coalesce(p_description, ''),
      trim(p_url), (select auth.uid()))
    returning * into v_resource;
  exception when check_violation then
    raise exception '제목(1~100자)과 https:// 로 시작하는 주소를 확인해 주세요.' using errcode = '23514';
  end;
  perform private.log_activity(v_event.term_id, 'EVENT', v_event.id, 'RESOURCE_ADD', null,
    jsonb_build_object('resource_id', v_resource.id, 'title', v_resource.title));
  return v_resource;
end;
$$;

-- 업로드한 파일을 자료로 등록한다. 파일은 Storage 정책이 먼저 검사했고, 여기서는 그 파일을
-- 지금 사용자가 이 행사 경로에 올렸는지 다시 확인한다.
create function public.register_event_upload(
  p_event_id uuid,
  p_title text,
  p_storage_path text,
  p_description text default ''
)
returns public.event_resources
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype := private.lock_visible_event(p_event_id);
  v_size bigint;
  v_resource public.event_resources%rowtype;
begin
  if v_event.status = 'ARCHIVED' then
    raise exception '보관된 행사에는 자료를 추가할 수 없습니다.' using errcode = '55000';
  end if;
  if split_part(p_storage_path, '/', 1) <> v_event.term_id::text
     or private.event_id_from_path(p_storage_path) is distinct from v_event.id then
    raise exception '파일 경로가 이 행사와 맞지 않습니다.' using errcode = '22023';
  end if;

  select (o.metadata ->> 'size')::bigint into v_size
  from storage.objects o
  where o.bucket_id = 'event-files' and o.name = p_storage_path
    and o.owner_id = (select auth.uid())::text;
  if not found then
    raise exception '올린 파일을 찾을 수 없습니다. 다시 올려 주세요.' using errcode = '22023';
  end if;

  begin
    insert into public.event_resources (
      event_id, term_id, resource_type, title, description, storage_path, size_bytes, uploaded_by)
    values (p_event_id, v_event.term_id, 'UPLOAD', trim(p_title), coalesce(p_description, ''),
      p_storage_path, v_size, (select auth.uid()))
    returning * into v_resource;
  exception
    when unique_violation then
      raise exception '이미 등록한 파일입니다.' using errcode = '23505';
    when check_violation then
      raise exception '제목은 1~100자로 입력해 주세요.' using errcode = '23514';
  end;
  perform private.log_activity(v_event.term_id, 'EVENT', v_event.id, 'RESOURCE_ADD', null,
    jsonb_build_object('resource_id', v_resource.id, 'title', v_resource.title));
  return v_resource;
end;
$$;

-- 자료 삭제: 등록한 사람이나 행사 관리자. 업로드 파일은 화면이 먼저 Storage에서 지운다.
-- 돌려준 storage_path는 화면이 파일 정리에 쓴다.
create function public.delete_event_resource(p_resource_id uuid)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_resource public.event_resources%rowtype;
  v_event public.events%rowtype;
begin
  select * into v_resource from public.event_resources where id = p_resource_id for update;
  if not found then
    raise exception '자료를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  v_event := private.lock_visible_event(v_resource.event_id);
  if v_resource.uploaded_by is distinct from (select auth.uid()) and not private.can_manage_event(v_event) then
    raise exception '자료를 등록한 사람이나 행사 관리자만 지울 수 있습니다.' using errcode = '42501';
  end if;
  if v_event.status = 'ARCHIVED' then
    raise exception '보관된 행사의 자료는 지울 수 없습니다.' using errcode = '55000';
  end if;

  delete from public.event_resources where id = p_resource_id;
  perform private.log_activity(v_event.term_id, 'EVENT', v_event.id, 'RESOURCE_DELETE',
    jsonb_build_object('resource_id', v_resource.id, 'title', v_resource.title), null);
  return v_resource.storage_path;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. 건의 쓰기 함수 (7장, D-9~D-13)
-- ---------------------------------------------------------------------

-- 제출: 로그인한 학교 계정 누구나. 작성자 연결은 서버가 만든다(7.2절)
create function public.submit_suggestion(p_title text, p_content text, p_request_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_term uuid;
  v_id uuid;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception '학교 계정으로 로그인해야 합니다.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception '요청 번호가 없습니다.' using errcode = '22023';
  end if;

  -- 같은 요청이 다시 오면 처음 만든 건의를 돌려준다
  select suggestion_id into v_id
  from public.suggestion_authors
  where author_user_id = v_uid and request_id = p_request_id;
  if found then
    return v_id;
  end if;

  select id into v_term from public.terms where status = 'ACTIVE';
  if v_term is null then
    raise exception '지금은 건의를 받지 않는 기간입니다.' using errcode = '55000';  -- D-12
  end if;

  -- shortcut: 빈도 제한은 하루 10건 고정값. 0.2절 운영값이 정해지면 바꾼다
  if (
    select count(*) from public.suggestion_authors a
    join public.suggestions s on s.id = a.suggestion_id
    where a.author_user_id = v_uid and s.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception '건의는 하루 10건까지 제출할 수 있습니다.' using errcode = '55000';
  end if;

  begin
    insert into public.suggestions (term_id, title, content)
    values (v_term, trim(p_title), trim(p_content))
    returning id into v_id;
  exception when check_violation then
    raise exception '제목은 1~100자, 내용은 1~3000자로 입력해 주세요.' using errcode = '23514';
  end;
  insert into public.suggestion_authors (suggestion_id, author_user_id, request_id)
  values (v_id, v_uid, p_request_id);

  -- 기록에는 작성자 id와 본문을 남기지 않는다(7.2절). actor_id도 비운다.
  insert into public.activity_logs (term_id, resource_type, resource_id, action)
  values (v_term, 'SUGGESTION', v_id, 'SUBMIT');
  return v_id;
end;
$$;

-- 철회: 작성자, RECEIVED일 때만 (D-9)
create function public.withdraw_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.suggestions%rowtype;
begin
  select * into v_s from public.suggestions where id = p_suggestion_id for update;
  if not found or not private.is_suggestion_author(p_suggestion_id) then
    raise exception '건의를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  if v_s.status <> 'RECEIVED' then
    raise exception '처리가 시작된 건의는 철회할 수 없습니다.' using errcode = '55000';
  end if;
  update public.suggestions set status = 'CLOSED', withdrawn_at = now() where id = p_suggestion_id;
  insert into public.activity_logs (term_id, resource_type, resource_id, action)
  values (v_s.term_id, 'SUGGESTION', v_s.id, 'WITHDRAW');
end;
$$;

-- 배정: 회장단만
create function public.assign_suggestion(
  p_suggestion_id uuid,
  p_department_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.suggestions%rowtype;
begin
  select * into v_s from public.suggestions where id = p_suggestion_id for update;
  if not found or not private.is_executive(v_s.term_id) then
    raise exception '회장단만 건의를 배정할 수 있습니다.' using errcode = '42501';
  end if;
  if p_user_id is not null and not private.is_active_member_of(v_s.term_id, p_user_id) then
    raise exception '담당자는 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;
  begin
    update public.suggestions
      set assigned_department_id = p_department_id, assigned_user_id = p_user_id
    where id = p_suggestion_id;
  exception when foreign_key_violation then
    raise exception '이 기수의 부서가 아닙니다.' using errcode = '22023';
  end;
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'ASSIGN',
    jsonb_build_object('department_id', v_s.assigned_department_id, 'user_id', v_s.assigned_user_id),
    jsonb_build_object('department_id', p_department_id, 'user_id', p_user_id));
end;
$$;

-- 상태 변경: 처리자. RESOLVED·CLOSED는 작성자 공개 답변이 하나 이상 있어야 한다(D-10)
create function public.change_suggestion_status(p_suggestion_id uuid, p_status public.suggestion_status)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.suggestions%rowtype;
begin
  select * into v_s from public.suggestions where id = p_suggestion_id for update;
  if not found or not private.is_suggestion_handler(p_suggestion_id) then
    raise exception '건의를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  if v_s.withdrawn_at is not null then
    raise exception '철회된 건의입니다.' using errcode = '55000';
  end if;
  if p_status is null or p_status = v_s.status then
    return;
  end if;
  if p_status in ('RESOLVED', 'CLOSED') and not exists (
    select 1 from public.suggestion_messages m
    where m.suggestion_id = p_suggestion_id and m.message_type = 'AUTHOR_VISIBLE'
  ) then
    raise exception '처리 완료나 종료 전에 작성자에게 보이는 답변을 먼저 남겨 주세요.' using errcode = '55000';
  end if;

  update public.suggestions
    set status = p_status,
        resolved_at = case when p_status = 'RESOLVED' then now() end
  where id = p_suggestion_id;
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_s.status), jsonb_build_object('status', p_status));
end;
$$;

-- 답변·내부 메모: 처리자
create function public.add_suggestion_message(
  p_suggestion_id uuid,
  p_type public.suggestion_message_type,
  p_body text
)
returns public.suggestion_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.suggestions%rowtype;
  v_m public.suggestion_messages%rowtype;
begin
  select * into v_s from public.suggestions where id = p_suggestion_id;
  if not found or not private.is_suggestion_handler(p_suggestion_id) then
    raise exception '건의를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  begin
    insert into public.suggestion_messages (suggestion_id, message_type, body, writer_id)
    values (p_suggestion_id, coalesce(p_type, 'INTERNAL'), trim(p_body), (select auth.uid()))
    returning * into v_m;
  exception when check_violation then
    raise exception '내용은 1~3000자로 입력해 주세요.' using errcode = '23514';
  end;
  -- 기록에는 본문을 복사하지 않는다
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'MESSAGE_ADD', null,
    jsonb_build_object('message_type', v_m.message_type));
  return v_m;
end;
$$;

-- 작성자 이름·이메일: 그 기수 회장단만 (7.1절). 학생 profile은 RLS로 보이지 않으므로 함수로 꺼낸다
create function public.suggestion_author_identity(p_suggestion_id uuid)
returns table (display_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.suggestions s
    where s.id = p_suggestion_id and private.is_executive(s.term_id)
  ) then
    raise exception '작성자 정보는 회장단만 볼 수 있습니다.' using errcode = '42501';
  end if;
  return query
    select p.display_name, p.email
    from public.suggestion_authors a
    join public.profiles p on p.id = a.author_user_id
    where a.suggestion_id = p_suggestion_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. 함수 실행 권한
-- ---------------------------------------------------------------------
revoke all on function
  public.create_event(uuid, uuid, text, text, timestamptz, timestamptz, public.event_visibility),
  public.update_event(uuid, text, text, timestamptz, timestamptz, uuid),
  public.change_event_status(uuid, public.event_status),
  public.set_event_visibility(uuid, public.event_visibility),
  public.add_event_access_rule(uuid, public.acl_subject_type, uuid, uuid, public.acl_role_group),
  public.remove_event_access_rule(uuid),
  public.add_event_link(uuid, text, text, text),
  public.register_event_upload(uuid, text, text, text),
  public.delete_event_resource(uuid),
  public.submit_suggestion(text, text, uuid),
  public.withdraw_suggestion(uuid),
  public.assign_suggestion(uuid, uuid, uuid),
  public.change_suggestion_status(uuid, public.suggestion_status),
  public.add_suggestion_message(uuid, public.suggestion_message_type, text),
  public.suggestion_author_identity(uuid)
from public, anon;

grant execute on function
  public.create_event(uuid, uuid, text, text, timestamptz, timestamptz, public.event_visibility),
  public.update_event(uuid, text, text, timestamptz, timestamptz, uuid),
  public.change_event_status(uuid, public.event_status),
  public.set_event_visibility(uuid, public.event_visibility),
  public.add_event_access_rule(uuid, public.acl_subject_type, uuid, uuid, public.acl_role_group),
  public.remove_event_access_rule(uuid),
  public.add_event_link(uuid, text, text, text),
  public.register_event_upload(uuid, text, text, text),
  public.delete_event_resource(uuid),
  public.submit_suggestion(text, text, uuid),
  public.withdraw_suggestion(uuid),
  public.assign_suggestion(uuid, uuid, uuid),
  public.change_suggestion_status(uuid, public.suggestion_status),
  public.add_suggestion_message(uuid, public.suggestion_message_type, text),
  public.suggestion_author_identity(uuid)
to authenticated;
