-- 회의록(Meeting Minutes)·Template·CRDT 공동편집 영속화·Realtime 채널 권한
-- 기준: 기획서 v0.8 6장, 1.6·1.7·5.2절, 부록 C.1 D-7·D-8(제안값으로 구현, 회장단 확정 필요)
-- 쓰기는 모두 아래 함수로만 한다. 테이블에 직접 insert·update·delete 권한은 주지 않는다.
-- 본문(Yjs Update)은 save_meeting_update()가 권한 검사·순번 발급·저장·Broadcast 발행을 한 트랜잭션에서 한다(6.4·6.5절).
-- shortcut: 주기적 Snapshot 압축과 오래된 Update 정리는 없다. Snapshot은 생성(v1)과 확정 때만 만든다.
--   Update가 많이 쌓여 첫 화면이 느려지면 서버 작업(Vercel Cron 등)으로 압축을 추가한다.

-- ---------------------------------------------------------------------
-- 1. 타입과 테이블
-- ---------------------------------------------------------------------
create type public.meeting_status as enum ('DRAFT', 'CONFIRMED', 'ARCHIVED');

create table public.meeting_templates (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  name text not null,
  blocks jsonb not null default '[]',   -- BlockNote 초기 Block 구조 (6.7절)
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meeting_templates_name_length check (length(trim(name)) between 1 and 50),
  constraint meeting_templates_blocks_array check (jsonb_typeof(blocks) = 'array'),
  constraint meeting_templates_blocks_size check (pg_column_size(blocks) <= 200000),
  constraint meeting_templates_term_id_id_key unique (term_id, id)
);

create trigger meeting_templates_set_updated_at
  before update on public.meeting_templates
  for each row execute function private.set_updated_at();

create table public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  event_id uuid,
  template_id uuid,
  title text not null,
  meeting_at timestamptz not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  author_id uuid not null references public.profiles (id) on delete restrict,
  status public.meeting_status not null default 'DRAFT',
  crdt_seq bigint not null default 0,   -- 회의록별 Update 순번. 저장 함수가 행 잠금으로 하나씩 올린다(6.5절)
  confirmed_at timestamptz,
  confirmed_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint meeting_minutes_title_length check (length(trim(title)) between 1 and 100),
  constraint meeting_minutes_event_same_term foreign key (term_id, event_id)
    references public.events (term_id, id) on delete restrict,
  constraint meeting_minutes_template_same_term foreign key (term_id, template_id)
    references public.meeting_templates (term_id, id) on delete restrict,
  constraint meeting_minutes_term_id_id_key unique (term_id, id)
);

create index meeting_minutes_term_status on public.meeting_minutes (term_id, status, updated_at desc);
create index meeting_minutes_event on public.meeting_minutes (event_id) where event_id is not null;

create trigger meeting_minutes_set_updated_at
  before update on public.meeting_minutes
  for each row execute function private.set_updated_at();

-- 열람 범위 Preset을 범용 ACL로 저장한다(6.3절). MVP는 ROLE_GROUP·DEPARTMENT만 쓴다(1.6절 예외)
create table public.meeting_access_rules (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null,
  term_id uuid not null,
  subject_type public.acl_subject_type not null,
  department_id uuid,
  role_group public.acl_role_group,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint meeting_access_subject_shape check (
    (subject_type = 'DEPARTMENT' and department_id is not null and role_group is null)
    or (subject_type = 'ROLE_GROUP' and role_group is not null and department_id is null)
  ),
  constraint meeting_access_unique_subject unique nulls not distinct
    (meeting_id, subject_type, department_id, role_group),
  constraint meeting_access_meeting_same_term foreign key (term_id, meeting_id)
    references public.meeting_minutes (term_id, id) on delete cascade,
  constraint meeting_access_department_same_term foreign key (term_id, department_id)
    references public.departments (term_id, id) on delete restrict
);

create index meeting_access_rules_meeting on public.meeting_access_rules (meeting_id);

create table public.meeting_editors (
  meeting_id uuid not null references public.meeting_minutes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete restrict,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (meeting_id, user_id)
);

create index meeting_editors_user on public.meeting_editors (user_id);

create table public.meeting_crdt_updates (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.meeting_minutes (id) on delete cascade,
  client_update_id uuid not null,
  sequence_no bigint not null,
  update_bytes bytea not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint meeting_crdt_updates_size check (octet_length(update_bytes) between 1 and 1048576),
  constraint meeting_crdt_updates_client_key unique (meeting_id, client_update_id),
  constraint meeting_crdt_updates_seq_key unique (meeting_id, sequence_no)
);

create table public.meeting_crdt_snapshots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meeting_minutes (id) on delete cascade,
  state_bytes bytea not null,
  state_vector bytea not null,
  snapshot_version integer not null,
  last_sequence_no bigint not null,
  created_at timestamptz not null default now(),

  constraint meeting_crdt_snapshots_size check (octet_length(state_bytes) <= 10485760),
  constraint meeting_crdt_snapshots_version_key unique (meeting_id, snapshot_version)
);

alter table public.activity_logs drop constraint activity_logs_resource_type_check;
alter table public.activity_logs add constraint activity_logs_resource_type_check
  check (resource_type in ('TASK', 'MEMBERSHIP', 'EVENT', 'SUGGESTION', 'MEETING'));

-- ---------------------------------------------------------------------
-- 2. 권한 판정 (6.2·6.3절, 5.2절 교집합)
-- ---------------------------------------------------------------------

-- 다른 사용자가 행사를 볼 수 있는지 (1.7절: 행사 회의록의 작성자·편집자 지정 검사)
-- can_view_event_values와 같은 규칙을 auth.uid() 대신 p_user_id로 계산한다.
create function private.user_can_view_event(p_event_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events e
    join public.memberships m on m.term_id = e.term_id and m.user_id = p_user_id and m.is_active
    where e.id = p_event_id
      and (
        e.visibility_mode = 'ALL_COUNCIL'
        or m.role = 'EXECUTIVE'
        or p_user_id in (e.created_by, e.manager_id)
        or m.department_id = e.owner_department_id
        or exists (
          select 1 from public.event_access_rules r
          where r.event_id = e.id
            and (
              (r.subject_type = 'USER' and r.user_id = p_user_id)
              or (r.subject_type = 'DEPARTMENT' and r.department_id = m.department_id)
              or (r.subject_type = 'ROLE_GROUP' and (
                r.role_group = 'ALL_COUNCIL'
                or (r.role_group = 'DIRECTORS' and m.role in ('DIRECTOR', 'EXECUTIVE'))
                or (r.role_group = 'EXECUTIVES' and m.role = 'EXECUTIVE')
              ))
            )
        )
      )
  )
$$;

-- 부서 전체가 행사를 볼 수 있는지 (1.7절: 행사 회의록의 "특정 국" 열람 범위 검사)
create function private.department_can_view_event(p_event_id uuid, p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        e.visibility_mode = 'ALL_COUNCIL'
        or e.owner_department_id = p_department_id
        or exists (
          select 1 from public.event_access_rules r
          where r.event_id = e.id
            and ((r.subject_type = 'DEPARTMENT' and r.department_id = p_department_id)
              or (r.subject_type = 'ROLE_GROUP' and r.role_group = 'ALL_COUNCIL'))
        )
      )
  )
$$;

create function private.is_meeting_editor(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meeting_editors e
    where e.meeting_id = p_meeting_id and e.user_id = (select auth.uid())
  )
$$;

-- 열람: (Preset 대상 ∪ 회장단 ∪ 생성자 ∪ 편집자) ∩ 행사 열람자
create function private.can_view_meeting_values(
  p_meeting_id uuid,
  p_term_id uuid,
  p_event_id uuid,
  p_created_by uuid
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
    where (
        cm.role = 'EXECUTIVE'
        or p_created_by = (select auth.uid())
        or private.is_meeting_editor(p_meeting_id)
        or exists (
          select 1 from public.meeting_access_rules r
          where r.meeting_id = p_meeting_id
            and (
              (r.subject_type = 'DEPARTMENT' and r.department_id = cm.department_id)
              or (r.subject_type = 'ROLE_GROUP' and (
                r.role_group = 'ALL_COUNCIL'
                or (r.role_group = 'DIRECTORS' and cm.role in ('DIRECTOR', 'EXECUTIVE'))
                or (r.role_group = 'EXECUTIVES' and cm.role = 'EXECUTIVE')
              ))
            )
        )
      )
      and (p_event_id is null or private.can_view_event(p_event_id))
  )
$$;

create function private.can_view_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.can_view_meeting_values(m.id, m.term_id, m.event_id, m.created_by)
    from public.meeting_minutes m
    where m.id = p_meeting_id
  ), false)
$$;

-- 관리(제목·일시·편집자·상태): 생성자 또는 회장단. 열람할 수 있어야 한다
create function private.can_manage_meeting(p_meeting public.meeting_minutes)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from private.current_membership(p_meeting.term_id) cm
      where cm.role = 'EXECUTIVE' or p_meeting.created_by = (select auth.uid())
    )
    and private.can_view_meeting_values(p_meeting.id, p_meeting.term_id, p_meeting.event_id, p_meeting.created_by)
$$;

-- 본문 편집: DRAFT이고, 지정 편집자 또는 회장단 (6.2·6.8절)
create function private.can_edit_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meeting_minutes m
    join private.current_membership(m.term_id) cm on true
    where m.id = p_meeting_id
      and m.status = 'DRAFT'
      and (cm.role = 'EXECUTIVE' or private.is_meeting_editor(m.id))
      and private.can_view_meeting_values(m.id, m.term_id, m.event_id, m.created_by)
  )
$$;

-- 볼 수 있는 회의록을 잠그고 돌려준다. 볼 수 없으면 있는지도 알려 주지 않는다.
create function private.lock_visible_meeting(p_meeting_id uuid)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_meeting public.meeting_minutes%rowtype;
begin
  select * into v_meeting from public.meeting_minutes where id = p_meeting_id for update;
  if not found or not private.can_view_meeting(p_meeting_id) then
    raise exception '회의록을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  return v_meeting;
end;
$$;

create function private.require_manage_meeting(p_meeting public.meeting_minutes)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_meeting(p_meeting) then
    raise exception '이 회의록을 관리할 권한이 없습니다.' using errcode = '42501';
  end if;
end;
$$;

-- 편집자로 지정할 수 있는지: 같은 기수 활성 구성원, 행사 회의록이면 행사 열람자 (6.2·1.7절)
create function private.require_assignable_editor(p_meeting public.meeting_minutes, p_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or not private.is_active_member_of(p_meeting.term_id, p_user_id) then
    raise exception '작성자·편집자는 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;
  if p_meeting.event_id is not null and not private.user_can_view_event(p_meeting.event_id, p_user_id) then
    raise exception '이 행사를 볼 수 없는 사람은 작성자·편집자로 지정할 수 없습니다.' using errcode = '22023';
  end if;
end;
$$;

-- Realtime 채널 이름 "meeting:<id>"에서 회의록 id를 꺼낸다. 형식이 다르면 null (6.6절)
create function private.meeting_id_from_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^meeting:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then substr(p_topic, 9)::uuid
  end
$$;

-- 상태가 바뀌었음을 접속자에게 알린다. 받은 쪽은 화면을 다시 불러 읽기 전용 여부를 바꾼다(6.8절)
create function private.broadcast_meeting_status(p_meeting public.meeting_minutes)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  select realtime.send(
    jsonb_build_object('status', p_meeting.status), 'status', 'meeting:' || p_meeting.id, true)
$$;

revoke all on function
  private.user_can_view_event(uuid, uuid),
  private.department_can_view_event(uuid, uuid),
  private.is_meeting_editor(uuid),
  private.can_view_meeting_values(uuid, uuid, uuid, uuid),
  private.can_view_meeting(uuid),
  private.can_manage_meeting(public.meeting_minutes),
  private.can_edit_meeting(uuid),
  private.lock_visible_meeting(uuid),
  private.require_manage_meeting(public.meeting_minutes),
  private.require_assignable_editor(public.meeting_minutes, uuid),
  private.meeting_id_from_topic(text),
  private.broadcast_meeting_status(public.meeting_minutes)
from public;

grant execute on function
  private.is_meeting_editor(uuid),
  private.can_view_meeting_values(uuid, uuid, uuid, uuid),
  private.can_view_meeting(uuid),
  private.can_edit_meeting(uuid),
  private.meeting_id_from_topic(text)
to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3. 테이블 권한과 RLS: 읽기만 허용한다
-- ---------------------------------------------------------------------
alter table public.meeting_templates enable row level security;
alter table public.meeting_minutes enable row level security;
alter table public.meeting_access_rules enable row level security;
alter table public.meeting_editors enable row level security;
alter table public.meeting_crdt_updates enable row level security;
alter table public.meeting_crdt_snapshots enable row level security;

grant select on
  public.meeting_templates, public.meeting_minutes, public.meeting_access_rules,
  public.meeting_editors, public.meeting_crdt_updates, public.meeting_crdt_snapshots
to authenticated;

-- 비활성 Template은 관리하는 회장단만 본다
create policy "meeting templates: term members"
  on public.meeting_templates for select
  to authenticated
  using ((is_active and private.is_member(term_id)) or private.is_executive(term_id));

create policy "meeting minutes: viewers"
  on public.meeting_minutes for select
  to authenticated
  using (private.can_view_meeting_values(id, term_id, event_id, created_by));

create policy "meeting access rules: meeting viewers"
  on public.meeting_access_rules for select
  to authenticated
  using (private.can_view_meeting(meeting_id));

create policy "meeting editors: meeting viewers"
  on public.meeting_editors for select
  to authenticated
  using (private.can_view_meeting(meeting_id));

create policy "meeting crdt updates: meeting viewers"
  on public.meeting_crdt_updates for select
  to authenticated
  using (private.can_view_meeting(meeting_id));

create policy "meeting crdt snapshots: meeting viewers"
  on public.meeting_crdt_snapshots for select
  to authenticated
  using (private.can_view_meeting(meeting_id));

drop policy "activity logs: resource viewers or executives" on public.activity_logs;
create policy "activity logs: resource viewers or executives"
  on public.activity_logs for select
  to authenticated
  using (
    private.is_executive(term_id)
    or (resource_type = 'TASK' and private.can_view_task(resource_id))
    or (resource_type = 'EVENT' and private.can_view_event(resource_id))
    or (resource_type = 'MEETING' and private.can_view_meeting(resource_id))
  );

-- ---------------------------------------------------------------------
-- 4. Realtime Private Channel 권한 (6.6절)
-- 받기(Broadcast·Presence): 회의록 열람자. 보내기: Presence는 열람자, Broadcast(awareness)는 편집자.
-- Realtime은 보내기 권한을 채널 참가 때 한 번(event 값 없이) 검사하므로 이벤트 이름별로 막을 수 없다.
-- 그래서 crdt-update·status 메시지에는 본문을 싣지 않고 "새 변경 있음" 신호로만 쓴다. 받은 쪽은
-- 본문을 항상 DB(RLS)에서 읽으므로, 편집자가 신호를 위조해도 문서에 없는 내용이 들어가지 않는다.
-- ---------------------------------------------------------------------
create policy "meeting channel: viewers receive"
  on realtime.messages for select
  to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and private.can_view_meeting(private.meeting_id_from_topic((select realtime.topic())))
  );

create policy "meeting channel: presence by viewers, awareness by editors"
  on realtime.messages for insert
  to authenticated
  with check (
    case realtime.messages.extension
      when 'presence' then private.can_view_meeting(private.meeting_id_from_topic((select realtime.topic())))
      when 'broadcast' then private.can_edit_meeting(private.meeting_id_from_topic((select realtime.topic())))
      else false
    end
  );

-- ---------------------------------------------------------------------
-- 5. Template 쓰기 함수 (회장단, 6.7절)
-- ---------------------------------------------------------------------
create function public.create_meeting_template(p_term_id uuid, p_name text, p_blocks jsonb)
returns public.meeting_templates
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_template public.meeting_templates%rowtype;
begin
  perform private.require_executive(p_term_id);
  begin
    insert into public.meeting_templates (term_id, name, blocks, created_by)
    values (p_term_id, trim(p_name), coalesce(p_blocks, '[]'), (select auth.uid()))
    returning * into v_template;
  exception when check_violation then
    raise exception '이름(1~50자)과 본문 크기를 확인해 주세요.' using errcode = '23514';
  end;
  return v_template;
end;
$$;

create function public.update_meeting_template(p_template_id uuid, p_name text, p_blocks jsonb)
returns public.meeting_templates
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_template public.meeting_templates%rowtype;
begin
  select * into v_template from public.meeting_templates where id = p_template_id for update;
  if not found then
    raise exception 'Template을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_template.term_id);
  begin
    update public.meeting_templates
      set name = trim(p_name), blocks = coalesce(p_blocks, '[]')
    where id = p_template_id
    returning * into v_template;
  exception when check_violation then
    raise exception '이름(1~50자)과 본문 크기를 확인해 주세요.' using errcode = '23514';
  end;
  return v_template;
end;
$$;

create function public.set_meeting_template_active(p_template_id uuid, p_active boolean)
returns public.meeting_templates
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_template public.meeting_templates%rowtype;
begin
  select * into v_template from public.meeting_templates where id = p_template_id for update;
  if not found then
    raise exception 'Template을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_template.term_id);
  update public.meeting_templates set is_active = coalesce(p_active, true)
  where id = p_template_id
  returning * into v_template;
  return v_template;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. 회의록 쓰기 함수 (6.2·6.3·6.7·6.8절)
-- ---------------------------------------------------------------------

-- p_scope: 열람 범위 Preset 하나. ALL_COUNCIL(전체) / DEPARTMENTS(특정 국) / DIRECTORS(국장단) / EXECUTIVES(회장단)
-- p_state·p_state_vector: Template Block으로 만든 Y.Doc 상태. 같은 트랜잭션에서 snapshot_version 1로 저장한다(6.7절)
create function public.create_meeting(
  p_term_id uuid,
  p_title text,
  p_meeting_at timestamptz,
  p_author_id uuid,
  p_editor_ids uuid[],
  p_scope text,
  p_department_ids uuid[],
  p_state bytea,
  p_state_vector bytea,
  p_event_id uuid default null,
  p_template_id uuid default null
)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_meeting public.meeting_minutes%rowtype;
  v_user uuid;
  v_dept uuid;
begin
  select cm.role into v_role from private.current_membership(p_term_id) cm;
  if v_role is null or v_role = 'MEMBER' then
    raise exception '국장과 회장단만 회의록을 만들 수 있습니다.' using errcode = '42501';
  end if;
  if p_scope is null or p_scope not in ('ALL_COUNCIL', 'DEPARTMENTS', 'DIRECTORS', 'EXECUTIVES') then
    raise exception '열람 범위를 하나 선택해 주세요.' using errcode = '22023';
  end if;
  if p_scope = 'DEPARTMENTS' and coalesce(cardinality(p_department_ids), 0) = 0 then
    raise exception '열람할 국을 하나 이상 선택해 주세요.' using errcode = '22023';
  end if;
  if p_meeting_at is null then
    raise exception '회의 일시를 입력해 주세요.' using errcode = '22023';
  end if;
  if p_state is null or p_state_vector is null then
    raise exception '회의록 초기 상태가 없습니다.' using errcode = '22023';
  end if;
  if p_event_id is not null and not exists (
    select 1 from public.events e
    where e.id = p_event_id and e.term_id = p_term_id and e.status <> 'ARCHIVED'
      and private.can_view_event(e.id)
  ) then
    raise exception '연결할 수 없는 행사입니다.' using errcode = '22023';
  end if;
  if p_template_id is not null and not exists (
    select 1 from public.meeting_templates t
    where t.id = p_template_id and t.term_id = p_term_id and t.is_active
  ) then
    raise exception '사용할 수 없는 Template입니다.' using errcode = '22023';
  end if;

  begin
    insert into public.meeting_minutes (
      term_id, event_id, template_id, title, meeting_at, created_by, author_id)
    values (
      p_term_id, p_event_id, p_template_id, trim(p_title), p_meeting_at,
      (select auth.uid()), p_author_id)
    returning * into v_meeting;
  exception when check_violation then
    raise exception '제목은 1~100자로 입력해 주세요.' using errcode = '23514';
  end;

  -- 대표 작성자는 자동으로 편집자다
  foreach v_user in array array_append(coalesce(p_editor_ids, '{}'), p_author_id) loop
    perform private.require_assignable_editor(v_meeting, v_user);
    insert into public.meeting_editors (meeting_id, user_id, granted_by)
    values (v_meeting.id, v_user, (select auth.uid()))
    on conflict do nothing;
  end loop;

  if p_scope = 'DEPARTMENTS' then
    foreach v_dept in array p_department_ids loop
      if not exists (
        select 1 from public.departments d where d.id = v_dept and d.term_id = p_term_id and d.is_active
      ) then
        raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
      end if;
      if p_event_id is not null and not private.department_can_view_event(p_event_id, v_dept) then
        raise exception '이 행사를 볼 수 없는 국은 열람 범위에 넣을 수 없습니다.' using errcode = '22023';
      end if;
      insert into public.meeting_access_rules (meeting_id, term_id, subject_type, department_id, granted_by)
      values (v_meeting.id, p_term_id, 'DEPARTMENT', v_dept, (select auth.uid()))
      on conflict do nothing;
    end loop;
  else
    insert into public.meeting_access_rules (meeting_id, term_id, subject_type, role_group, granted_by)
    values (v_meeting.id, p_term_id, 'ROLE_GROUP', p_scope::public.acl_role_group, (select auth.uid()));
  end if;

  begin
    insert into public.meeting_crdt_snapshots (meeting_id, state_bytes, state_vector, snapshot_version, last_sequence_no)
    values (v_meeting.id, p_state, p_state_vector, 1, 0);
  exception when check_violation then
    raise exception '회의록 초기 상태가 너무 큽니다.' using errcode = '23514';
  end;

  perform private.log_activity(p_term_id, 'MEETING', v_meeting.id, 'CREATE', null,
    jsonb_build_object('title', v_meeting.title, 'scope', p_scope, 'event_id', p_event_id));
  return v_meeting;
end;
$$;

create function public.update_meeting(p_meeting_id uuid, p_title text, p_meeting_at timestamptz)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_new public.meeting_minutes%rowtype;
begin
  perform private.require_manage_meeting(v_old);
  if v_old.status = 'ARCHIVED' then
    raise exception '보관된 회의록은 바꿀 수 없습니다.' using errcode = '55000';
  end if;
  if p_meeting_at is null then
    raise exception '회의 일시를 입력해 주세요.' using errcode = '22023';
  end if;
  begin
    update public.meeting_minutes set title = trim(p_title), meeting_at = p_meeting_at
    where id = p_meeting_id
    returning * into v_new;
  exception when check_violation then
    raise exception '제목은 1~100자로 입력해 주세요.' using errcode = '23514';
  end;
  perform private.log_activity(v_new.term_id, 'MEETING', v_new.id, 'UPDATE',
    jsonb_build_object('title', v_old.title, 'meeting_at', v_old.meeting_at),
    jsonb_build_object('title', v_new.title, 'meeting_at', v_new.meeting_at));
  return v_new;
end;
$$;

-- 대표 작성자 지정. 새 작성자는 편집자에도 들어간다
create function public.set_meeting_author(p_meeting_id uuid, p_author_id uuid)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_new public.meeting_minutes%rowtype;
begin
  perform private.require_manage_meeting(v_old);
  perform private.require_assignable_editor(v_old, p_author_id);
  update public.meeting_minutes set author_id = p_author_id where id = p_meeting_id returning * into v_new;
  insert into public.meeting_editors (meeting_id, user_id, granted_by)
  values (p_meeting_id, p_author_id, (select auth.uid()))
  on conflict do nothing;
  perform private.log_activity(v_new.term_id, 'MEETING', v_new.id, 'AUTHOR_CHANGE',
    jsonb_build_object('author_id', v_old.author_id), jsonb_build_object('author_id', v_new.author_id));
  return v_new;
end;
$$;

create function public.add_meeting_editor(p_meeting_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_meeting public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
begin
  perform private.require_manage_meeting(v_meeting);
  perform private.require_assignable_editor(v_meeting, p_user_id);
  insert into public.meeting_editors (meeting_id, user_id, granted_by)
  values (p_meeting_id, p_user_id, (select auth.uid()));
  perform private.log_activity(v_meeting.term_id, 'MEETING', v_meeting.id, 'EDITOR_ADD', null,
    jsonb_build_object('user_id', p_user_id));
exception when unique_violation then
  raise exception '이미 편집자입니다.' using errcode = '23505';
end;
$$;

create function public.remove_meeting_editor(p_meeting_id uuid, p_user_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_meeting public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
begin
  perform private.require_manage_meeting(v_meeting);
  if p_user_id = v_meeting.author_id then
    raise exception '대표 작성자는 편집자에서 뺄 수 없습니다. 작성자를 먼저 바꿔 주세요.' using errcode = '22023';
  end if;
  delete from public.meeting_editors where meeting_id = p_meeting_id and user_id = p_user_id;
  if found then
    perform private.log_activity(v_meeting.term_id, 'MEETING', v_meeting.id, 'EDITOR_REMOVE',
      jsonb_build_object('user_id', p_user_id), null);
  end if;
end;
$$;

-- 본문 Yjs Update 저장 (6.5절). 같은 client_update_id 재요청은 기존 순번을 돌려준다.
-- 회의록 행을 잠그고 crdt_seq를 올려 순번을 정하므로, 커밋 순서와 순번이 어긋나지 않는다.
-- Broadcast는 커밋된 경우에만 전달된다.
create function public.save_meeting_update(p_meeting_id uuid, p_client_update_id uuid, p_update bytea)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_meeting public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_seq bigint;
begin
  select u.sequence_no into v_seq
  from public.meeting_crdt_updates u
  where u.meeting_id = p_meeting_id and u.client_update_id = p_client_update_id;
  if found then
    return v_seq;
  end if;

  if v_meeting.status <> 'DRAFT' then
    raise exception '확정되었거나 보관된 회의록은 고칠 수 없습니다.' using errcode = '55000';
  end if;
  if not private.can_edit_meeting(p_meeting_id) then
    raise exception '이 회의록을 편집할 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_client_update_id is null or p_update is null or octet_length(p_update) not between 1 and 1048576 then
    raise exception '저장할 수 없는 변경입니다. 내용을 나눠 붙여 넣어 주세요.' using errcode = '22023';
  end if;

  update public.meeting_minutes set crdt_seq = crdt_seq + 1
  where id = p_meeting_id
  returning crdt_seq into v_seq;

  insert into public.meeting_crdt_updates (meeting_id, client_update_id, sequence_no, update_bytes, actor_id)
  values (p_meeting_id, p_client_update_id, v_seq, p_update, (select auth.uid()));

  -- 본문은 싣지 않는다(4절 Realtime 권한 설명). 받은 쪽이 sequence_no 이후를 DB에서 읽는다
  perform realtime.send(jsonb_build_object('seq', v_seq), 'crdt-update', 'meeting:' || p_meeting_id, true);
  return v_seq;
end;
$$;

-- 확정: 최종 Snapshot을 저장하고 읽기 전용으로 바꾼다 (6.8절).
-- Snapshot은 서버 작업이 Snapshot + Update를 합쳐 만든다. 그 사이 새 Update가 저장됐으면 거부한다.
create function public.confirm_meeting(
  p_meeting_id uuid,
  p_state bytea,
  p_state_vector bytea,
  p_last_sequence_no bigint
)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_new public.meeting_minutes%rowtype;
begin
  perform private.require_manage_meeting(v_old);
  if v_old.status <> 'DRAFT' then
    raise exception '작성 중인 회의록만 확정할 수 있습니다.' using errcode = '55000';
  end if;
  if p_last_sequence_no is distinct from v_old.crdt_seq or p_state is null or p_state_vector is null then
    raise exception '확정하는 동안 새 변경이 저장되었습니다. 다시 시도해 주세요.' using errcode = '40001';
  end if;

  insert into public.meeting_crdt_snapshots (meeting_id, state_bytes, state_vector, snapshot_version, last_sequence_no)
  select p_meeting_id, p_state, p_state_vector, coalesce(max(s.snapshot_version), 0) + 1, p_last_sequence_no
  from public.meeting_crdt_snapshots s
  where s.meeting_id = p_meeting_id;

  update public.meeting_minutes
    set status = 'CONFIRMED', confirmed_at = now(), confirmed_by = (select auth.uid())
  where id = p_meeting_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'MEETING', v_new.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_old.status), jsonb_build_object('status', v_new.status));
  perform private.broadcast_meeting_status(v_new);
  return v_new;
end;
$$;

-- 확정 외 상태 전환 (6.8절)
-- CONFIRMED→DRAFT: 회장단만, 사유 필수 / DRAFT·CONFIRMED→ARCHIVED: 생성자·회장단 / ARCHIVED→DRAFT: 회장단만
create function public.change_meeting_status(
  p_meeting_id uuid,
  p_status public.meeting_status,
  p_reason text default null
)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_new public.meeting_minutes%rowtype;
begin
  perform private.require_manage_meeting(v_old);
  if p_status = 'CONFIRMED' then
    raise exception '확정은 확정 기능으로 해 주세요.' using errcode = '22023';
  end if;
  if p_status is null or p_status = v_old.status then
    raise exception '바꿀 상태를 선택해 주세요.' using errcode = '22023';
  end if;
  if p_status = 'DRAFT' and not private.is_executive(v_old.term_id) then
    raise exception '확정 해제와 보관 해제는 회장단만 할 수 있습니다.' using errcode = '42501';
  end if;
  if v_old.status = 'CONFIRMED' and p_status = 'DRAFT' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception '확정을 해제하는 사유를 입력해 주세요.' using errcode = '22023';
  end if;

  update public.meeting_minutes
    set status = p_status,
        confirmed_at = case when p_status = 'DRAFT' then null else confirmed_at end,
        confirmed_by = case when p_status = 'DRAFT' then null else confirmed_by end
  where id = p_meeting_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'MEETING', v_new.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_old.status),
    jsonb_strip_nulls(jsonb_build_object('status', v_new.status, 'reason', nullif(trim(p_reason), ''))));
  perform private.broadcast_meeting_status(v_new);
  return v_new;
end;
$$;

revoke all on function
  public.create_meeting_template(uuid, text, jsonb),
  public.update_meeting_template(uuid, text, jsonb),
  public.set_meeting_template_active(uuid, boolean),
  public.create_meeting(uuid, text, timestamptz, uuid, uuid[], text, uuid[], bytea, bytea, uuid, uuid),
  public.update_meeting(uuid, text, timestamptz),
  public.set_meeting_author(uuid, uuid),
  public.add_meeting_editor(uuid, uuid),
  public.remove_meeting_editor(uuid, uuid),
  public.save_meeting_update(uuid, uuid, bytea),
  public.confirm_meeting(uuid, bytea, bytea, bigint),
  public.change_meeting_status(uuid, public.meeting_status, text)
from public, anon;

grant execute on function
  public.create_meeting_template(uuid, text, jsonb),
  public.update_meeting_template(uuid, text, jsonb),
  public.set_meeting_template_active(uuid, boolean),
  public.create_meeting(uuid, text, timestamptz, uuid, uuid[], text, uuid[], bytea, bytea, uuid, uuid),
  public.update_meeting(uuid, text, timestamptz),
  public.set_meeting_author(uuid, uuid),
  public.add_meeting_editor(uuid, uuid),
  public.remove_meeting_editor(uuid, uuid),
  public.save_meeting_update(uuid, uuid, bytea),
  public.confirm_meeting(uuid, bytea, bytea, bigint),
  public.change_meeting_status(uuid, public.meeting_status, text)
to authenticated;
