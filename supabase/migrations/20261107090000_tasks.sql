-- 업무(Task), 열람 ACL, 활동 기록, 소속 종료 시 관리 책임 이전
-- 기준: 기획서 v0.8 1.5·1.6·1.7·4장·10.3절, 부록 C.1 D-1~D-5 (2026-11-05 확정)
-- 쓰기는 모두 아래 함수로만 한다. 테이블에 직접 insert·update·delete 권한은 주지 않는다.
-- Event 연결(event_id)과 1.7절 검사는 Event 테이블이 생기는 기반 작업에서 추가한다.

-- ---------------------------------------------------------------------
-- 1. 타입
-- ---------------------------------------------------------------------
create type public.task_status as enum ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE');
create type public.task_priority as enum ('LOW', 'NORMAL', 'HIGH');                -- D-1
create type public.visibility_mode as enum ('DEFAULT', 'RESTRICTED');
-- ACL 대상 형식은 Event·Task·Meeting이 함께 쓴다 (기획서 1.6절)
create type public.acl_subject_type as enum ('DEPARTMENT', 'USER', 'ROLE_GROUP');
create type public.acl_role_group as enum ('ALL_COUNCIL', 'DIRECTORS', 'EXECUTIVES');

-- ---------------------------------------------------------------------
-- 2. 업무
-- ---------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  department_id uuid not null,                                                  -- D-3
  title text not null,
  description text not null default '',
  creator_id uuid not null references public.profiles (id) on delete restrict,
  assignee_id uuid references public.profiles (id) on delete restrict,
  manager_id uuid not null references public.profiles (id) on delete restrict,  -- D-4: 기본 생성자
  status public.task_status not null default 'TODO',
  priority public.task_priority not null default 'NORMAL',
  start_date date,
  due_date date,
  completed_at timestamptz,
  visibility_mode public.visibility_mode not null default 'DEFAULT',
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_title_length check (length(trim(title)) between 1 and 200),
  constraint tasks_description_length check (length(description) <= 10000),
  constraint tasks_date_order check (start_date is null or due_date is null or start_date <= due_date),
  -- D-2: DONE일 때만 완료 시각이 있다
  constraint tasks_completed_state check ((status = 'DONE') = (completed_at is not null)),
  constraint tasks_archived_pair check ((archived_at is null) = (archived_by is null)),
  constraint tasks_department_same_term foreign key (term_id, department_id)
    references public.departments (term_id, id) on delete restrict,
  constraint tasks_term_id_id_key unique (term_id, id)
);

create index tasks_term_department on public.tasks (term_id, department_id);
create index tasks_assignee on public.tasks (assignee_id) where archived_at is null;
create index tasks_manager on public.tasks (manager_id) where archived_at is null;
create index tasks_creator on public.tasks (creator_id);

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. 업무 열람 대상 (기획서 4.4절)
-- ---------------------------------------------------------------------
create table public.task_access_rules (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  term_id uuid not null,
  subject_type public.acl_subject_type not null,
  department_id uuid,
  user_id uuid references public.profiles (id) on delete restrict,
  role_group public.acl_role_group,
  granted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  -- 대상 종류에 맞는 칸 하나만 채운다
  constraint task_access_subject_shape check (
    (subject_type = 'DEPARTMENT' and department_id is not null and user_id is null and role_group is null)
    or (subject_type = 'USER' and user_id is not null and department_id is null and role_group is null)
    or (subject_type = 'ROLE_GROUP' and role_group is not null and department_id is null and user_id is null)
  ),
  constraint task_access_unique_subject unique nulls not distinct
    (task_id, subject_type, department_id, user_id, role_group),
  -- 업무와 부서가 같은 기수여야 한다
  constraint task_access_task_same_term foreign key (term_id, task_id)
    references public.tasks (term_id, id) on delete cascade,
  constraint task_access_department_same_term foreign key (term_id, department_id)
    references public.departments (term_id, id) on delete restrict
);

create index task_access_rules_task on public.task_access_rules (task_id);
create index task_access_rules_user on public.task_access_rules (user_id) where user_id is not null;

-- ---------------------------------------------------------------------
-- 4. 활동 기록 (기획서 10.3절). 추가만 하고 고치거나 지우지 않는다.
-- 본문 전문, 건의 작성자, 파일 서명 URL, 토큰은 넣지 않는다.
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id bigint generated always as identity primary key,
  term_id uuid not null references public.terms (id) on delete restrict,
  -- 새 자원(EVENT, MEETING 등)이 생기면 Migration에서 목록을 늘린다
  resource_type text not null check (resource_type in ('TASK', 'MEMBERSHIP')),
  resource_id uuid not null,
  action text not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  before_summary jsonb,
  after_summary jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_resource on public.activity_logs (resource_type, resource_id, created_at desc);
create index activity_logs_term on public.activity_logs (term_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. 권한 판정 (RLS와 RPC가 같은 함수를 쓴다)
-- 업무가 속한 기수의 활성 소속(private.current_membership)만 인정한다.
-- ---------------------------------------------------------------------

-- 행의 값으로 열람 여부를 판정한다. RLS에서 행마다 다시 조회하지 않도록 값을 받는다.
create function private.can_view_task_values(
  p_task_id uuid,
  p_term_id uuid,
  p_department_id uuid,
  p_creator_id uuid,
  p_assignee_id uuid,
  p_manager_id uuid,
  p_visibility public.visibility_mode
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
      or (select auth.uid()) in (p_creator_id, p_assignee_id, p_manager_id)
      or (p_visibility = 'DEFAULT' and cm.department_id = p_department_id)
      or exists (
        select 1 from public.task_access_rules r
        where r.task_id = p_task_id
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

create function private.can_view_task(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select private.can_view_task_values(
      t.id, t.term_id, t.department_id, t.creator_id, t.assignee_id, t.manager_id, t.visibility_mode)
    from public.tasks t
    where t.id = p_task_id
  ), false)
$$;

-- "관리 가능한 Task" (기획서 4.5·4.6절)
-- 회장단: 같은 기수 전체 / 국장: 자기 국의 DEFAULT 업무 또는 자신이 관리 책임자인 업무
create function private.can_manage_task(p_task public.tasks)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.current_membership(p_task.term_id) cm
    where cm.role = 'EXECUTIVE'
      or (cm.role = 'DIRECTOR' and (
        (p_task.visibility_mode = 'DEFAULT' and p_task.department_id = cm.department_id)
        or p_task.manager_id = (select auth.uid())
      ))
  )
$$;

-- 그 기수에 활성 소속이 있는 사용자인지 (담당자·ACL 대상 검사)
create function private.is_active_member_of(p_term_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.term_id = p_term_id and m.user_id = p_user_id and m.is_active
  )
$$;

-- 활동 기록. 행위자와 시각은 서버에서 정한다.
create function private.log_activity(
  p_term_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_action text,
  p_before jsonb default null,
  p_after jsonb default null
)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.activity_logs (term_id, resource_type, resource_id, action, actor_id, before_summary, after_summary)
  values (p_term_id, p_resource_type, p_resource_id, p_action, (select auth.uid()), p_before, p_after)
$$;

-- 볼 수 있는 업무를 잠그고 돌려준다. 볼 수 없으면 있는지도 알려 주지 않는다.
create function private.lock_visible_task(p_task_id uuid)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  select * into v_task from public.tasks where id = p_task_id for update;
  if not found or not private.can_view_task(p_task_id) then
    raise exception '업무를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  return v_task;
end;
$$;

create function private.require_not_archived(p_task public.tasks)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_task.archived_at is not null then
    raise exception '보관된 업무입니다. 먼저 복원하세요.' using errcode = '55000';
  end if;
end;
$$;

revoke all on function
  private.can_view_task_values(uuid, uuid, uuid, uuid, uuid, uuid, public.visibility_mode),
  private.can_view_task(uuid),
  private.can_manage_task(public.tasks),
  private.is_active_member_of(uuid, uuid),
  private.log_activity(uuid, text, uuid, text, jsonb, jsonb),
  private.lock_visible_task(uuid),
  private.require_not_archived(public.tasks)
from public;

-- RLS 정책이 부르는 함수
grant execute on function
  private.can_view_task_values(uuid, uuid, uuid, uuid, uuid, uuid, public.visibility_mode),
  private.can_view_task(uuid),
  private.can_manage_task(public.tasks)
to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 6. 테이블 권한과 RLS: 읽기만 허용한다
-- ---------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_access_rules enable row level security;
alter table public.activity_logs enable row level security;

grant select on public.tasks, public.task_access_rules, public.activity_logs to authenticated;

create policy "tasks: viewers"
  on public.tasks for select
  to authenticated
  using (private.can_view_task_values(
    id, term_id, department_id, creator_id, assignee_id, manager_id, visibility_mode));

-- 열람 대상 목록은 그 업무를 볼 수 있는 사람만 본다
create policy "task access rules: task viewers"
  on public.task_access_rules for select
  to authenticated
  using (private.can_view_task(task_id));

-- 기록 조회는 대상 자원의 열람 권한을 넘지 않는다. 전체 조회는 회장단만 (10.3절)
create policy "activity logs: resource viewers or executives"
  on public.activity_logs for select
  to authenticated
  using (
    private.is_executive(term_id)
    or (resource_type = 'TASK' and private.can_view_task(resource_id))
  );

-- ---------------------------------------------------------------------
-- 7. 업무 쓰기 함수 (기획서 4.6절 권한표)
-- ---------------------------------------------------------------------

-- 생성: 국장은 자기 국, 회장단은 같은 기수 전체. 관리 책임자는 생성자(D-4)
create function public.create_task(
  p_term_id uuid,
  p_department_id uuid,
  p_title text,
  p_description text default '',
  p_assignee_id uuid default null,
  p_priority public.task_priority default 'NORMAL',
  p_start_date date default null,
  p_due_date date default null,
  p_visibility_mode public.visibility_mode default 'DEFAULT'
)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_dept uuid;
  v_task public.tasks%rowtype;
begin
  select cm.role, cm.department_id into v_role, v_dept
  from private.current_membership(p_term_id) cm;

  if v_role is null or v_role = 'MEMBER' then
    raise exception '국장과 회장단만 업무를 만들 수 있습니다.' using errcode = '42501';
  end if;
  if v_role = 'DIRECTOR' and p_department_id is distinct from v_dept then
    raise exception '국장은 자기 국 업무만 만들 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.term_id = p_term_id and d.is_active
  ) then
    raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
  end if;
  if p_assignee_id is not null and not private.is_active_member_of(p_term_id, p_assignee_id) then
    raise exception '담당자는 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;

  begin
    insert into public.tasks (
      term_id, department_id, title, description, creator_id, assignee_id, manager_id,
      priority, start_date, due_date, visibility_mode)
    values (
      p_term_id, p_department_id, trim(p_title), coalesce(p_description, ''),
      (select auth.uid()), p_assignee_id, (select auth.uid()),
      coalesce(p_priority, 'NORMAL'), p_start_date, p_due_date, coalesce(p_visibility_mode, 'DEFAULT'))
    returning * into v_task;
  exception when check_violation then
    raise exception '제목(1~200자), 설명(10,000자 이하), 시작일·마감일 순서를 확인해 주세요.' using errcode = '23514';
  end;

  perform private.log_activity(p_term_id, 'TASK', v_task.id, 'CREATE', null,
    jsonb_build_object('title', v_task.title, 'department_id', v_task.department_id,
      'assignee_id', v_task.assignee_id, 'visibility_mode', v_task.visibility_mode));
  return v_task;
end;
$$;

-- 제목·담당자·우선순위·일정: 관리 가능한 사람
create function public.update_task(
  p_task_id uuid,
  p_title text,
  p_assignee_id uuid,
  p_priority public.task_priority,
  p_start_date date,
  p_due_date date
)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
begin
  v_old := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_old);
  if not private.can_manage_task(v_old) then
    raise exception '이 업무의 제목·담당자·일정을 바꿀 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_assignee_id is not null and not private.is_active_member_of(v_old.term_id, p_assignee_id) then
    raise exception '담당자는 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;

  begin
    update public.tasks
      set title = trim(p_title),
          assignee_id = p_assignee_id,
          priority = coalesce(p_priority, 'NORMAL'),
          start_date = p_start_date,
          due_date = p_due_date
    where id = p_task_id
    returning * into v_new;
  exception when check_violation then
    raise exception '제목(1~200자)과 시작일·마감일 순서를 확인해 주세요.' using errcode = '23514';
  end;

  perform private.log_activity(v_new.term_id, 'TASK', v_new.id,
    case when v_old.assignee_id is distinct from v_new.assignee_id then 'ASSIGNEE_CHANGE' else 'UPDATE' end,
    jsonb_build_object('title', v_old.title, 'assignee_id', v_old.assignee_id,
      'priority', v_old.priority, 'start_date', v_old.start_date, 'due_date', v_old.due_date),
    jsonb_build_object('title', v_new.title, 'assignee_id', v_new.assignee_id,
      'priority', v_new.priority, 'start_date', v_new.start_date, 'due_date', v_new.due_date));
  return v_new;
end;
$$;

-- 설명: 담당자 본인 또는 관리 가능한 사람. 기록에는 본문을 남기지 않는다.
create function public.update_task_description(p_task_id uuid, p_description text)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
begin
  v_old := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_old);
  if v_old.assignee_id is distinct from (select auth.uid()) and not private.can_manage_task(v_old) then
    raise exception '담당자나 관리 권한이 있는 사람만 설명을 바꿀 수 있습니다.' using errcode = '42501';
  end if;

  begin
    update public.tasks set description = coalesce(p_description, '')
    where id = p_task_id
    returning * into v_new;
  exception when check_violation then
    raise exception '설명은 10,000자까지 쓸 수 있습니다.' using errcode = '23514';
  end;

  perform private.log_activity(v_new.term_id, 'TASK', v_new.id, 'DESCRIPTION_UPDATE',
    jsonb_build_object('length', length(v_old.description)),
    jsonb_build_object('length', length(v_new.description)));
  return v_new;
end;
$$;

-- 상태 변경 (D-2): 담당자 본인 또는 관리 가능한 사람. 네 상태 사이를 자유롭게 바꾼다.
create function public.change_task_status(p_task_id uuid, p_status public.task_status)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
begin
  v_old := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_old);
  if v_old.assignee_id is distinct from (select auth.uid()) and not private.can_manage_task(v_old) then
    raise exception '담당자나 관리 권한이 있는 사람만 상태를 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if p_status is null or p_status = v_old.status then
    return v_old;
  end if;

  update public.tasks
    set status = p_status,
        completed_at = case when p_status = 'DONE' then now() else null end
  where id = p_task_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'TASK', v_new.id,
    case when v_old.status = 'DONE' then 'REOPEN' else 'STATUS_CHANGE' end,
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', v_new.status));
  return v_new;
end;
$$;

-- 공개 모드 전환 (4.5절). 국장이 제한 공개로 바꾸려면 관리 책임자여야 한다(바꾼 뒤에도 관리할 수 있도록).
create function public.set_task_visibility(p_task_id uuid, p_mode public.visibility_mode)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
begin
  v_old := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_old);
  if not private.can_manage_task(v_old) then
    raise exception '이 업무의 공개 범위를 바꿀 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_mode = 'RESTRICTED' and not private.is_executive(v_old.term_id)
     and v_old.manager_id is distinct from (select auth.uid()) then
    raise exception '제한 공개로 바꾸려면 이 업무의 관리 책임자여야 합니다.' using errcode = '42501';
  end if;
  if p_mode is null or p_mode = v_old.visibility_mode then
    return v_old;
  end if;

  update public.tasks set visibility_mode = p_mode
  where id = p_task_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'TASK', v_new.id, 'VISIBILITY_CHANGE',
    jsonb_build_object('visibility_mode', v_old.visibility_mode),
    jsonb_build_object('visibility_mode', v_new.visibility_mode));
  return v_new;
end;
$$;

-- 열람 대상 추가 (4.3·4.5절). 대상은 같은 기수의 부서·활성 구성원이어야 한다.
create function public.add_task_access_rule(
  p_task_id uuid,
  p_subject_type public.acl_subject_type,
  p_department_id uuid default null,
  p_user_id uuid default null,
  p_role_group public.acl_role_group default null
)
returns public.task_access_rules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_rule public.task_access_rules%rowtype;
begin
  v_task := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_task);
  if not private.can_manage_task(v_task) then
    raise exception '이 업무의 열람 대상을 바꿀 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_subject_type = 'DEPARTMENT' and not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.term_id = v_task.term_id and d.is_active
  ) then
    raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
  end if;
  if p_subject_type = 'USER' and not private.is_active_member_of(v_task.term_id, p_user_id) then
    raise exception '열람 대상은 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;

  begin
    insert into public.task_access_rules (
      task_id, term_id, subject_type, department_id, user_id, role_group, granted_by)
    values (
      p_task_id, v_task.term_id, p_subject_type,
      case when p_subject_type = 'DEPARTMENT' then p_department_id end,
      case when p_subject_type = 'USER' then p_user_id end,
      case when p_subject_type = 'ROLE_GROUP' then p_role_group end,
      (select auth.uid()))
    returning * into v_rule;
  exception
    when unique_violation then
      raise exception '이미 추가된 열람 대상입니다.' using errcode = '23505';
    when check_violation then
      raise exception '열람 대상을 하나 골라 주세요.' using errcode = '22023';
  end;

  perform private.log_activity(v_task.term_id, 'TASK', v_task.id, 'ACL_ADD', null,
    jsonb_build_object('subject_type', v_rule.subject_type, 'department_id', v_rule.department_id,
      'user_id', v_rule.user_id, 'role_group', v_rule.role_group));
  return v_rule;
end;
$$;

create function public.remove_task_access_rule(p_rule_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_rule public.task_access_rules%rowtype;
  v_task public.tasks%rowtype;
begin
  select * into v_rule from public.task_access_rules where id = p_rule_id;
  if not found then
    raise exception '열람 대상을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  v_task := private.lock_visible_task(v_rule.task_id);
  perform private.require_not_archived(v_task);
  if not private.can_manage_task(v_task) then
    raise exception '이 업무의 열람 대상을 바꿀 권한이 없습니다.' using errcode = '42501';
  end if;

  delete from public.task_access_rules where id = p_rule_id;

  perform private.log_activity(v_task.term_id, 'TASK', v_task.id, 'ACL_REMOVE',
    jsonb_build_object('subject_type', v_rule.subject_type, 'department_id', v_rule.department_id,
      'user_id', v_rule.user_id, 'role_group', v_rule.role_group), null);
end;
$$;

-- 관리 책임자 변경 (4.5절): 회장단, 또는 현재 관리 책임자인 국장이 같은 기수 국장·회장단에게 넘긴다
create function public.set_task_manager(p_task_id uuid, p_manager_id uuid)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
begin
  v_old := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_old);
  if not (private.is_executive(v_old.term_id)
          or (v_old.manager_id = (select auth.uid()) and private.member_role(v_old.term_id) = 'DIRECTOR')) then
    raise exception '관리 책임자는 회장단이나 현재 관리 책임자만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.term_id = v_old.term_id and m.user_id = p_manager_id and m.is_active
      and m.role in ('DIRECTOR', 'EXECUTIVE')
  ) then
    raise exception '관리 책임자는 이 기수의 국장이나 회장단이어야 합니다.' using errcode = '22023';
  end if;

  update public.tasks set manager_id = p_manager_id
  where id = p_task_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'TASK', v_new.id, 'MANAGER_CHANGE',
    jsonb_build_object('manager_id', v_old.manager_id),
    jsonb_build_object('manager_id', v_new.manager_id));
  return v_new;
end;
$$;

-- 보관·복원 (4.6절): 물리 삭제하지 않는다
create function public.archive_task(p_task_id uuid)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  v_task := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_task);
  if not private.can_manage_task(v_task) then
    raise exception '이 업무를 보관할 권한이 없습니다.' using errcode = '42501';
  end if;

  update public.tasks set archived_at = now(), archived_by = (select auth.uid())
  where id = p_task_id
  returning * into v_task;

  perform private.log_activity(v_task.term_id, 'TASK', v_task.id, 'ARCHIVE', null, null);
  return v_task;
end;
$$;

create function public.restore_task(p_task_id uuid)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  v_task := private.lock_visible_task(p_task_id);
  if v_task.archived_at is null then
    return v_task;
  end if;
  if not private.can_manage_task(v_task) then
    raise exception '이 업무를 복원할 권한이 없습니다.' using errcode = '42501';
  end if;

  update public.tasks set archived_at = null, archived_by = null
  where id = p_task_id
  returning * into v_task;

  perform private.log_activity(v_task.term_id, 'TASK', v_task.id, 'RESTORE', null, null);
  return v_task;
end;
$$;

-- ---------------------------------------------------------------------
-- 8. 소속 종료 시 관리 책임 이전 (기획서 1.5절)
-- 종료하는 사람이 넘겨받을 사람을 고르지 않으면 소속 국의 활성 국장, 없으면 종료를 실행한
-- 회장단(국장이 실행했다면 그 국장)이 미완료 업무의 관리 책임을 넘겨받는다.
-- 담당자는 바꾸지 않는다. 목록에서 "담당자 비활성"으로 보이고 재배정한다.
-- ---------------------------------------------------------------------

-- 종료 확인 화면에 보여 줄 영향 (미완료·보관 안 된 업무 기준)
create function public.membership_responsibilities(p_membership_id uuid)
returns table (assigned_open_tasks integer, managed_open_tasks integer, restricted_managed_tasks integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.memberships%rowtype;
  v_my_role public.member_role;
  v_my_dept uuid;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found or not v_m.is_active then
    raise exception '활성 소속을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  select cm.role, cm.department_id into v_my_role, v_my_dept
  from private.current_membership(v_m.term_id) cm;
  if not (v_my_role = 'EXECUTIVE'
          or (v_my_role = 'DIRECTOR' and v_m.role = 'MEMBER' and v_m.department_id = v_my_dept)) then
    raise exception '이 구성원의 정보를 볼 권한이 없습니다.' using errcode = '42501';
  end if;

  return query
  select
    count(*) filter (where t.assignee_id = v_m.user_id)::integer,
    count(*) filter (where t.manager_id = v_m.user_id)::integer,
    count(*) filter (where t.manager_id = v_m.user_id and t.visibility_mode = 'RESTRICTED')::integer
  from public.tasks t
  where t.term_id = v_m.term_id
    and t.status <> 'DONE'
    and t.archived_at is null
    and v_m.user_id in (t.assignee_id, t.manager_id);
end;
$$;

-- 인자가 바뀌므로 다시 만든다. 기존 호출 end_membership(p_membership_id)는 그대로 동작한다.
drop function public.end_membership(uuid);

create function public.end_membership(p_membership_id uuid, p_transfer_to uuid default null)
returns public.memberships
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.memberships%rowtype;
  v_my_role public.member_role;
  v_my_dept uuid;
  v_heir uuid;
  v_task record;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if not found or not v_m.is_active then
    raise exception '활성 소속을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  select cm.role, cm.department_id into v_my_role, v_my_dept
  from private.current_membership(v_m.term_id) cm;

  if not (v_my_role = 'EXECUTIVE'
          or (v_my_role = 'DIRECTOR' and v_m.role = 'MEMBER' and v_m.department_id = v_my_dept)) then
    raise exception '이 구성원을 종료할 권한이 없습니다.' using errcode = '42501';
  end if;

  if v_m.role = 'EXECUTIVE' and private.is_last_executive(v_m.term_id, v_m.id) then
    raise exception '마지막 회장단은 종료할 수 없습니다. 다른 회장단을 먼저 등록하세요.' using errcode = '55000';
  end if;

  if p_transfer_to is not null and (
    p_transfer_to = v_m.user_id
    or not exists (
      select 1 from public.memberships m
      where m.term_id = v_m.term_id and m.user_id = p_transfer_to and m.is_active
        and m.role in ('DIRECTOR', 'EXECUTIVE')
    )
  ) then
    raise exception '관리 책임은 이 기수의 다른 국장이나 회장단에게만 넘길 수 있습니다.' using errcode = '22023';
  end if;

  update public.memberships
    set is_active = false,
        left_at = now()
  where id = p_membership_id
  returning * into v_m;

  -- 미완료 업무의 관리 책임을 넘긴다. 업무마다 그 업무 담당 국의 국장을 먼저 찾는다.
  for v_task in
    select t.id, t.department_id from public.tasks t
    where t.term_id = v_m.term_id and t.manager_id = v_m.user_id
      and t.status <> 'DONE' and t.archived_at is null
    for update
  loop
    -- 종료된 사람은 이미 비활성이므로 아래 조회에 나오지 않는다
    v_heir := coalesce(
      p_transfer_to,
      (select m.user_id from public.memberships m
       where m.term_id = v_m.term_id and m.department_id = v_task.department_id
         and m.role = 'DIRECTOR' and m.is_active
       limit 1),
      -- 종료를 실행한 사람 (회장단이 자기 소속을 종료한 경우는 제외)
      (select m.user_id from public.memberships m
       where m.term_id = v_m.term_id and m.user_id = (select auth.uid()) and m.is_active),
      (select m.user_id from public.memberships m
       where m.term_id = v_m.term_id and m.role = 'EXECUTIVE' and m.is_active
       order by m.joined_at
       limit 1)
    );

    update public.tasks set manager_id = v_heir where id = v_task.id;
    perform private.log_activity(v_m.term_id, 'TASK', v_task.id, 'MANAGER_CHANGE',
      jsonb_build_object('manager_id', v_m.user_id),
      jsonb_build_object('manager_id', v_heir, 'reason', 'MEMBERSHIP_END'));
  end loop;

  perform private.log_activity(v_m.term_id, 'MEMBERSHIP', v_m.id, 'END',
    jsonb_build_object('role', v_m.role, 'department_id', v_m.department_id), null);

  return v_m;
end;
$$;

-- ---------------------------------------------------------------------
-- 9. 실행 권한: 로그인 사용자만. 함수 안에서 권한을 다시 검사한다.
-- ---------------------------------------------------------------------
revoke all on function
  public.create_task(uuid, uuid, text, text, uuid, public.task_priority, date, date, public.visibility_mode),
  public.update_task(uuid, text, uuid, public.task_priority, date, date),
  public.update_task_description(uuid, text),
  public.change_task_status(uuid, public.task_status),
  public.set_task_visibility(uuid, public.visibility_mode),
  public.add_task_access_rule(uuid, public.acl_subject_type, uuid, uuid, public.acl_role_group),
  public.remove_task_access_rule(uuid),
  public.set_task_manager(uuid, uuid),
  public.archive_task(uuid),
  public.restore_task(uuid),
  public.membership_responsibilities(uuid),
  public.end_membership(uuid, uuid)
from public, anon;

grant execute on function
  public.create_task(uuid, uuid, text, text, uuid, public.task_priority, date, date, public.visibility_mode),
  public.update_task(uuid, text, uuid, public.task_priority, date, date),
  public.update_task_description(uuid, text),
  public.change_task_status(uuid, public.task_status),
  public.set_task_visibility(uuid, public.visibility_mode),
  public.add_task_access_rule(uuid, public.acl_subject_type, uuid, uuid, public.acl_role_group),
  public.remove_task_access_rule(uuid),
  public.set_task_manager(uuid, uuid),
  public.archive_task(uuid),
  public.restore_task(uuid),
  public.membership_responsibilities(uuid),
  public.end_membership(uuid, uuid)
to authenticated;
