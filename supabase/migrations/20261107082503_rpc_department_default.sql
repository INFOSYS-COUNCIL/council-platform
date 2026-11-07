-- 회장단의 "부서 없음"을 TypeScript에서 그대로 전달할 수 있게 부서 인자에 기본값 null을 둔다.
-- DB는 원래 null을 받지만, 기본값이 없으면 생성된 타입이 p_department_id를 필수 string으로 만든다.
-- 화면은 부서가 없으면 p_department_id를 빼고 보낸다. 함수 본문은 member_admin과 같다(인자 기본값만 추가).

create or replace function public.update_approved_account(
  p_account_id uuid,
  p_role public.member_role,
  p_department_id uuid default null,
  p_position_id uuid default null
)
returns public.approved_council_accounts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.approved_council_accounts%rowtype := private.lock_manageable_account(p_account_id);
  v_is_exec boolean := private.is_executive(v_account.term_id);
begin
  if v_account.activated_user_id is not null then
    raise exception '이미 활성화된 계정입니다. 소속 변경은 구성원 관리에서 합니다.' using errcode = '55000';
  end if;
  if not v_is_exec and (p_role <> 'MEMBER' or p_department_id is distinct from v_account.department_id) then
    raise exception '국장은 자기 국 국원의 직책만 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if p_role <> 'EXECUTIVE' and p_department_id is null then
    raise exception '회장단이 아니면 부서가 필요합니다.' using errcode = '22023';
  end if;
  if p_role = 'DIRECTOR'
     and (v_account.role <> 'DIRECTOR' or v_account.department_id is distinct from p_department_id)
     and private.department_has_director(p_department_id) then
    raise exception '이 부서에는 이미 국장이 있습니다.' using errcode = '23505';
  end if;

  update public.approved_council_accounts
    set role = p_role,
        department_id = p_department_id,
        position_id = p_position_id
  where id = p_account_id
  returning * into v_account;

  return v_account;
end;
$$;

create or replace function public.change_member_role(
  p_membership_id uuid,
  p_role public.member_role,
  p_department_id uuid default null,
  p_position_id uuid default null
)
returns public.memberships
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.memberships%rowtype;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if not found or not v_m.is_active then
    raise exception '활성 소속을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  perform private.require_executive(v_m.term_id);

  if v_m.role = 'EXECUTIVE' and p_role <> 'EXECUTIVE'
     and private.is_last_executive(v_m.term_id, v_m.id) then
    raise exception '마지막 회장단은 강등할 수 없습니다.' using errcode = '55000';
  end if;
  if p_role <> 'EXECUTIVE' and p_department_id is null then
    raise exception '회장단이 아니면 부서가 필요합니다.' using errcode = '22023';
  end if;
  if p_department_id is not null and not exists (
    select 1 from public.departments d
    where d.id = p_department_id and d.term_id = v_m.term_id and d.is_active
  ) then
    raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
  end if;

  begin
    update public.memberships
      set role = p_role,
          department_id = p_department_id,
          position_id = p_position_id
    where id = p_membership_id
    returning * into v_m;
  exception when unique_violation then
    raise exception '이 부서에는 이미 국장이 있습니다.' using errcode = '23505';
  end;

  return v_m;
end;
$$;
