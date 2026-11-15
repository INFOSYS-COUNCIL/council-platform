-- 업무 글(3차 사용 피드백): 업무 설명(무슨 일인지) 아래에 담당자가 실제 결과물(공지글 본문, 구글폼 링크 등)을 쓴다.
-- 기록 > 페이지 기능과 연동한다. 업무마다 페이지 하나(tasks.page_id)를 만들어 같은 공동 편집기로 쓰고,
-- 그 업무를 볼 수 있는 사람(담당자·국장·회장단 등)은 그 페이지도 보고 고친다. 검토는 기존 검토 요청 흐름 그대로.

alter table public.tasks
  add column page_id uuid unique references public.meeting_minutes (id) on delete set null;

-- 페이지 열람에 "연결된 업무를 볼 수 있는 사람"을 더한다. 나머지는 20261112150000_pages.sql과 같다.
create or replace function private.can_view_meeting_values(
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
              or (r.subject_type = 'USER' and r.user_id = (select auth.uid()))
              or (r.subject_type = 'ROLE_GROUP' and (
                r.role_group = 'ALL_COUNCIL'
                or (r.role_group = 'DIRECTORS' and cm.role in ('DIRECTOR', 'EXECUTIVE'))
                or (r.role_group = 'EXECUTIVES' and cm.role = 'EXECUTIVE')
              ))
            )
        )
        or exists (
          select 1 from public.tasks t
          where t.page_id = p_meeting_id and private.can_view_task(t.id)
        )
      )
      and (p_event_id is null or private.can_view_event(p_event_id))
  )
$$;

-- 업무 글 페이지 만들기: 담당자나 관리 권한자. 이미 있으면 그 페이지를 돌려준다.
-- 페이지 자체 공개 범위는 만든 사람만(지정 공개)으로 두고, 나머지 열람은 위의 "연결된 업무" 규칙이 맡는다.
create function public.create_task_page(p_task_id uuid, p_state bytea, p_state_vector bytea)
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
  if v_task.assignee_id is distinct from (select auth.uid()) and not private.can_manage_task(v_task) then
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

revoke execute on function public.create_task_page(uuid, bytea, bytea) from public, anon;
grant execute on function public.create_task_page(uuid, bytea, bytea) to authenticated;
