-- 2차 QA: 회의록 '수정'에서 열람 범위도 바꾼다. 권한은 회의 정보 수정과 같다(private.require_manage_meeting).
-- 규칙은 create_meeting과 같다: Preset 하나, DEPARTMENTS면 사용 중인 국 하나 이상(행사 회의록이면 그 행사를 볼 수 있는 국만).

create function public.set_meeting_scope(p_meeting_id uuid, p_scope text, p_department_ids uuid[] default '{}')
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_dept uuid;
begin
  perform private.require_manage_meeting(v_m);
  if v_m.status = 'ARCHIVED' then
    raise exception '보관된 회의록은 바꿀 수 없습니다.' using errcode = '55000';
  end if;
  if p_scope is null or p_scope not in ('ALL_COUNCIL', 'DEPARTMENTS', 'DIRECTORS', 'EXECUTIVES') then
    raise exception '열람 범위를 하나 선택해 주세요.' using errcode = '22023';
  end if;
  if p_scope = 'DEPARTMENTS' and coalesce(cardinality(p_department_ids), 0) = 0 then
    raise exception '열람할 국을 하나 이상 선택해 주세요.' using errcode = '22023';
  end if;

  delete from public.meeting_access_rules where meeting_id = p_meeting_id;

  if p_scope = 'DEPARTMENTS' then
    foreach v_dept in array p_department_ids loop
      if not exists (
        select 1 from public.departments d where d.id = v_dept and d.term_id = v_m.term_id and d.is_active
      ) then
        raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
      end if;
      if v_m.event_id is not null and not private.department_can_view_event(v_m.event_id, v_dept) then
        raise exception '이 행사를 볼 수 없는 국은 열람 범위에 넣을 수 없습니다.' using errcode = '22023';
      end if;
      insert into public.meeting_access_rules (meeting_id, term_id, subject_type, department_id, granted_by)
      values (p_meeting_id, v_m.term_id, 'DEPARTMENT', v_dept, (select auth.uid()))
      on conflict do nothing;
    end loop;
  else
    insert into public.meeting_access_rules (meeting_id, term_id, subject_type, role_group, granted_by)
    values (p_meeting_id, v_m.term_id, 'ROLE_GROUP', p_scope::public.acl_role_group, (select auth.uid()));
  end if;

  perform private.log_activity(v_m.term_id, 'MEETING', v_m.id, 'SCOPE_CHANGE', null,
    jsonb_build_object('scope', p_scope, 'department_ids', to_jsonb(coalesce(p_department_ids, '{}'))));
end;
$$;

revoke all on function public.set_meeting_scope(uuid, text, uuid[]) from public, anon;
grant execute on function public.set_meeting_scope(uuid, text, uuid[]) to authenticated;
