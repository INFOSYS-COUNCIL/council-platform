-- 2차 사용 피드백: 업무 삭제. 보관과 같은 권한(회장단, 담당 국 국장, 지정 공개 업무의 관리자)만.
-- 접근 규칙은 외래 키 cascade로 함께 지워진다. 기록에는 제목만 남긴다(본문은 남기지 않음).

create function public.delete_task(p_task_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task public.tasks%rowtype;
begin
  v_task := private.lock_visible_task(p_task_id);
  if not private.can_manage_task(v_task) then
    raise exception '이 업무를 지울 권한이 없습니다.' using errcode = '42501';
  end if;

  delete from public.tasks where id = p_task_id;
  perform private.log_activity(v_task.term_id, 'TASK', v_task.id, 'DELETE',
    jsonb_build_object('title', v_task.title), null);
end;
$$;

revoke execute on function public.delete_task(uuid) from public, anon;
grant execute on function public.delete_task(uuid) to authenticated;
