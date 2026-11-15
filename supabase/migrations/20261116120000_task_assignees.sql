-- 기존 단일 담당자 API를 유지하면서 여러 담당자를 원자적으로 저장한다.
create table public.task_assignees (
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete restrict,
  primary key (task_id, user_id)
);
create index task_assignees_user on public.task_assignees(user_id, task_id);
insert into public.task_assignees(task_id, user_id)
select id, assignee_id from public.tasks where assignee_id is not null;

alter table public.task_assignees enable row level security;
revoke all on public.task_assignees from public, anon, authenticated;
grant select on public.task_assignees to authenticated;
create policy task_assignees_read on public.task_assignees for select to authenticated
using (private.can_view_task(task_id));

create function private.is_task_assignee(p_task_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.task_assignees a where a.task_id = p_task_id and a.user_id = p_user_id)
$$;
revoke all on function private.is_task_assignee(uuid, uuid) from public, anon, authenticated;

-- 이전 클라이언트가 단일 담당자를 변경하면 연결 목록도 같은 배정으로 맞춘다.
create function private.sync_task_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then return null; end if;
  delete from public.task_assignees where task_id = new.id;
  if new.assignee_id is not null then
    insert into public.task_assignees(task_id, user_id) values(new.id, new.assignee_id);
  end if;
  return null;
end;
$$;
revoke all on function private.sync_task_assignee() from public, anon, authenticated;
create trigger tasks_sync_assignee after insert or update of assignee_id on public.tasks
for each row execute function private.sync_task_assignee();

create or replace function private.can_view_task_values(
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
      or private.is_task_assignee(p_task_id, (select auth.uid()))
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

create or replace function public.update_task_description(p_task_id uuid, p_description text)
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
  if not private.is_task_assignee(v_old.id, (select auth.uid())) and not private.can_manage_task(v_old) then
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

create or replace function public.change_task_status(p_task_id uuid, p_status public.task_status)
returns public.tasks
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.tasks%rowtype;
  v_new public.tasks%rowtype;
  v_manager boolean;
begin
  v_old := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_old);
  v_manager := private.can_manage_task(v_old);
  if not private.is_task_assignee(v_old.id, (select auth.uid())) and not v_manager then
    raise exception '담당자나 관리 권한이 있는 사람만 상태를 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if p_status is null or p_status = v_old.status then
    return v_old;
  end if;
  if not v_manager and (p_status = 'DONE' or v_old.status = 'DONE') then
    raise exception '완료 처리는 국장이 검토 요청을 승인해야 합니다. 일을 마쳤다면 검토 요청을 보내 주세요.' using errcode = '42501';
  end if;

  update public.tasks
    set status = p_status,
        completed_at = case when p_status = 'DONE' then now() else null end
  where id = p_task_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'TASK', v_new.id,
    case
      when v_old.status = 'DONE' then 'REOPEN'
      when v_old.status = 'REVIEW' and p_status = 'DONE' then 'REVIEW_APPROVE'
      when v_old.status = 'REVIEW' and p_status = 'IN_PROGRESS' then 'REVIEW_RETURN'
      when p_status = 'REVIEW' then 'REVIEW_REQUEST'
      else 'STATUS_CHANGE'
    end,
    jsonb_build_object('status', v_old.status),
    jsonb_build_object('status', v_new.status));
  return v_new;
end;
$$;

create or replace function public.create_task_page(p_task_id uuid, p_state bytea, p_state_vector bytea)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
  v_page public.meeting_minutes%rowtype;
begin
  v_task := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_task);
  if not private.is_task_assignee(v_task.id, (select auth.uid())) and not private.can_manage_task(v_task) then
    raise exception '담당자나 관리 권한이 있는 사람만 업무 글을 시작할 수 있습니다.' using errcode = '42501';
  end if;
  if v_task.page_id is not null then
    return v_task.page_id;
  end if;

  v_page := public.create_page(v_task.term_id, left(v_task.title, 100), p_state, p_state_vector,
    array['업무'], 'USERS', '{}', array[(select auth.uid())]);
  update public.tasks set page_id = v_page.id where id = p_task_id;
  perform private.log_activity(v_task.term_id, 'TASK', v_task.id, 'PAGE_CREATE', null, null);
  return v_page.id;
end;
$$;

create or replace function public.membership_responsibilities(p_membership_id uuid)
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
    count(*) filter (where private.is_task_assignee(t.id, v_m.user_id))::integer,
    count(*) filter (where t.manager_id = v_m.user_id)::integer,
    count(*) filter (where t.manager_id = v_m.user_id and t.visibility_mode = 'RESTRICTED')::integer
  from public.tasks t
  where t.term_id = v_m.term_id
    and t.status <> 'DONE'
    and t.archived_at is null
    and (private.is_task_assignee(t.id, v_m.user_id) or t.manager_id = v_m.user_id);
end;
$$;

create or replace function public.update_task(
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
  if p_assignee_id is distinct from v_old.assignee_id and p_assignee_id is not null and not private.is_active_member_of(v_old.term_id, p_assignee_id) then
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

create function public.set_task_assignees(p_task_id uuid, p_user_ids uuid[])
returns public.tasks language plpgsql volatile security definer set search_path = '' as $$
declare
  v_task public.tasks%rowtype;
  v_before uuid[];
  v_ids uuid[];
begin
  v_task := private.lock_visible_task(p_task_id);
  perform private.require_not_archived(v_task);
  if not private.can_manage_task(v_task) then
    raise exception '이 업무의 담당자를 바꿀 권한이 없습니다.' using errcode = '42501';
  end if;
  if p_user_ids is null or array_position(p_user_ids, null) is not null then
    raise exception '담당자 목록을 확인해 주세요.' using errcode = '22023';
  end if;
  select coalesce(array_agg(a.user_id order by a.user_id), '{}'::uuid[]) into v_before
  from public.task_assignees a where a.task_id = p_task_id;
  v_ids := array(select distinct u from unnest(p_user_ids) u order by u);
  if exists(select 1 from unnest(v_ids) u where not (u = any(v_before)) and not private.is_active_member_of(v_task.term_id, u)) then
    raise exception '담당자는 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
  end if;
  if v_before = v_ids then return v_task; end if;
  update public.tasks set assignee_id = v_ids[1] where id = p_task_id returning * into v_task;
  delete from public.task_assignees where task_id = p_task_id;
  insert into public.task_assignees(task_id, user_id) select p_task_id, u from unnest(v_ids) u;
  perform private.log_activity(v_task.term_id, 'TASK', p_task_id, 'ASSIGNEE_CHANGE',
    jsonb_build_object('assignee_ids', v_before), jsonb_build_object('assignee_ids', v_ids));
  return v_task;
end;
$$;

create function public.create_task_with_assignees(
  p_term_id uuid, p_department_id uuid, p_title text,
  p_description text default '', p_assignee_ids uuid[] default '{}',
  p_priority public.task_priority default 'NORMAL', p_start_date date default null,
  p_due_date date default null, p_visibility_mode public.visibility_mode default 'DEFAULT'
)
returns public.tasks language plpgsql volatile security definer set search_path = '' as $$
declare v_task public.tasks%rowtype;
begin
  v_task := public.create_task(p_term_id, p_department_id, p_title, p_description, null,
    p_priority, p_start_date, p_due_date, p_visibility_mode);
  return public.set_task_assignees(v_task.id, p_assignee_ids);
end;
$$;

create function public.update_task_with_assignees(
  p_task_id uuid, p_title text, p_assignee_ids uuid[], p_priority public.task_priority,
  p_start_date date, p_due_date date
)
returns public.tasks language plpgsql volatile security definer set search_path = '' as $$
declare v_task public.tasks%rowtype;
begin
  v_task := public.set_task_assignees(p_task_id, p_assignee_ids);
  return public.update_task(p_task_id, p_title, v_task.assignee_id, p_priority, p_start_date, p_due_date);
end;
$$;

revoke all on function public.set_task_assignees(uuid, uuid[]),
  public.create_task_with_assignees(uuid, uuid, text, text, uuid[], public.task_priority, date, date, public.visibility_mode),
  public.update_task_with_assignees(uuid, text, uuid[], public.task_priority, date, date) from public, anon;
grant execute on function public.set_task_assignees(uuid, uuid[]),
  public.create_task_with_assignees(uuid, uuid, text, text, uuid[], public.task_priority, date, date, public.visibility_mode),
  public.update_task_with_assignees(uuid, text, uuid[], public.task_priority, date, date) to authenticated;
