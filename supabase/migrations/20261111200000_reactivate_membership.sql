-- 소속 종료한 구성원에게 학생회 권한 다시 주기(사용 피드백).
-- 종료하면 Membership이 비활성이 되고, 승인 행은 이미 쓰인 상태라 다시 로그인해도 활성화되지 않았다.
-- 가입 승인 명단의 ⋯ 메뉴에서 그 승인 행의 Membership을 다시 활성으로 돌린다(역할·부서·직책은 승인 행 값).
-- 권한: 종료와 같다. 회장단은 누구나, 국장은 자기 국 국원만.

create function public.reactivate_membership(p_account_id uuid)
returns public.memberships
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_a public.approved_council_accounts%rowtype;
  v_m public.memberships%rowtype;
  v_my_role public.member_role;
  v_my_dept uuid;
begin
  select * into v_a from public.approved_council_accounts where id = p_account_id for update;
  if not found then
    raise exception '승인 명단을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  select cm.role, cm.department_id into v_my_role, v_my_dept
  from private.current_membership(v_a.term_id) cm;
  if not (v_my_role = 'EXECUTIVE'
          or (v_my_role = 'DIRECTOR' and v_a.role = 'MEMBER' and v_a.department_id = v_my_dept)) then
    raise exception '이 구성원에게 권한을 다시 줄 권한이 없습니다.' using errcode = '42501';
  end if;

  select * into v_m from public.memberships where approved_account_id = p_account_id for update;
  if not found or v_m.is_active then
    raise exception '소속을 종료한 구성원만 다시 활성화할 수 있습니다.' using errcode = '55000';
  end if;
  if not v_a.is_active then
    raise exception '등록 취소된 승인 명단입니다.' using errcode = '55000';
  end if;

  begin
    update public.memberships
      set is_active = true,
          left_at = null,
          role = v_a.role,
          department_id = v_a.department_id,
          position_id = v_a.position_id
    where id = v_m.id
    returning * into v_m;
  exception when unique_violation then
    raise exception '이미 이 기수에 활동 중인 소속이 있거나, 그 국에 이미 국장이 있습니다.' using errcode = '23505';
  end;

  perform private.log_activity(v_m.term_id, 'MEMBERSHIP', v_m.id, 'REACTIVATE',
    null, jsonb_build_object('role', v_m.role, 'department_id', v_m.department_id));
  return v_m;
end;
$$;

revoke execute on function public.reactivate_membership(uuid) from public, anon;
grant execute on function public.reactivate_membership(uuid) to authenticated;
