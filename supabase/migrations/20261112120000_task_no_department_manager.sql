-- 2차 QA (업무)
-- 1) 업무 만들기에 '담당국 없음'을 둔다. 담당국이 없는 업무는 회장단·생성자·담당자·관리 책임자·열람 규칙 대상만 본다
--    (can_view_task_values의 국 비교는 null이면 거짓이라 그대로 둔다).
-- 2) 관리 책임자는 직급과 상관없이 그 업무를 관리한다. 그래서 책임자가 검토 요청을 승인(완료)할 수 있다.

alter table public.tasks alter column department_id drop not null;

create or replace function private.can_manage_task(p_task public.tasks)
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
      or p_task.manager_id = (select auth.uid())
      or (cm.role = 'DIRECTOR' and p_task.visibility_mode = 'DEFAULT' and p_task.department_id = cm.department_id)
  )
$$;

-- 본문은 20261107090000_tasks.sql과 같다. 담당국 null 허용만 달라졌다.
create or replace function public.create_task(
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
  if v_role = 'DIRECTOR' and p_department_id is not null and p_department_id is distinct from v_dept then
    raise exception '국장은 자기 국 업무만 만들 수 있습니다.' using errcode = '42501';
  end if;
  if p_department_id is not null and not exists (
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
