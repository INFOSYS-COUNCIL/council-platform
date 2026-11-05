-- 현재 사용자의 기수별 활성 소속을 한 함수로 모은다
-- 기준: 기획서 v0.8 10.4절 (private.current_membership)
-- member_role·member_department에 같은 "활성 소속" 조건이 반복되어 있었다.
-- 앞으로 추가하는 권한 함수(업무·행사·회의록)도 이 함수 하나를 기준으로 쓴다.

-- 접근할 수 있는 소속이 없으면 행이 없다.
-- ACTIVE 기수는 활성 구성원 전체, DRAFT 기수는 EXECUTIVE만, CLOSED는 아무도 (기획서 8.1절)
create function private.current_membership(p_term_id uuid)
returns table (membership_id uuid, role public.member_role, department_id uuid, position_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.role, m.department_id, m.position_id
  from public.memberships m
  join public.terms t on t.id = m.term_id
  where m.term_id = p_term_id
    and m.user_id = (select auth.uid())
    and m.is_active
    and (t.status = 'ACTIVE' or (t.status = 'DRAFT' and m.role = 'EXECUTIVE'))
$$;

comment on function private.current_membership(uuid) is
  '현재 사용자의 해당 기수 활성 소속. 권한 함수는 소속 조건을 직접 쓰지 말고 이 함수를 쓴다.';

-- 기존 함수는 이름과 반환값을 유지하고 내부만 바꾼다 (RLS 정책은 그대로)
create or replace function private.member_role(p_term_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$ select cm.role from private.current_membership(p_term_id) cm $$;

create or replace function private.member_department(p_term_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select cm.department_id from private.current_membership(p_term_id) cm $$;

revoke all on function private.current_membership(uuid) from public;
grant execute on function private.current_membership(uuid) to authenticated, service_role;
