-- 업무 검토·승인(사용 피드백): 국원이 일을 마치면 "검토 요청(REVIEW)"을 보내고, 국장(관리 권한자)이 승인해 완료한다.
--   관리 권한이 없는 담당자: 시작 전·진행 중·검토 요청 사이에서만 바꾼다. 완료로 바꾸거나 완료된 업무를 되돌릴 수 없다.
--   관리 권한자(회장단, 담당 국 국장, 관리 책임자 국장): 모든 상태로 바꾼다. 검토 요청 → 완료(승인) / 진행 중(다시 하기).

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
  if v_old.assignee_id is distinct from (select auth.uid()) and not v_manager then
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
