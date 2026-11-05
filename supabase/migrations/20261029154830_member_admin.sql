-- 구성원 관리 기반: 학번, 승인 명단 일괄 등록·수정·취소, 소속 종료·Role 변경, 부서·직책 관리
-- 기준: 기획서 v0.8 1.1·1.5·2.2·2.3·9.2절, 부록 C.1 D-14·D-17·D-18
-- 쓰기는 모두 아래 함수로만 한다. 테이블에 직접 insert·update 권한은 주지 않는다.
-- 업무·행사 테이블이 생기면 소속 종료 때 관리 책임 이전(기획서 1.5)을 end_membership에 추가한다.

-- ---------------------------------------------------------------------
-- 1. 학번 (D-14)
-- 승인 명단 행에 둔다. 이 테이블의 기존 RLS(회장단은 기수 전체, 국장은 자기 국)와
-- 아래 "본인 행" 정책을 합치면 본인·회장단·소속 국장만 학번을 보게 된다.
-- profiles는 같은 기수 구성원 모두가 읽을 수 있으므로 학번을 두지 않는다.
-- ---------------------------------------------------------------------
alter table public.profiles drop column student_no;

alter table public.approved_council_accounts
  add column student_no text,
  add constraint approved_student_no_format check (student_no is null or student_no ~ '^[0-9]{10}$');

comment on column public.approved_council_accounts.student_no is
  '학번(숫자 10자리). 본인·그 기수 회장단·소속 국장만 본다 (기획서 C.1 D-14).';

create unique index approved_term_student_no_key
  on public.approved_council_accounts (term_id, student_no)
  where student_no is not null;

create policy "approved accounts: own activated row"
  on public.approved_council_accounts for select
  to authenticated
  using (activated_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- 2. 공통 검사
-- ---------------------------------------------------------------------

-- 그 기수의 회장단이 아니면 거부한다.
create function private.require_executive(p_term_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_executive(p_term_id) then
    raise exception '회장단만 할 수 있습니다.' using errcode = '42501';
  end if;
end;
$$;

-- 활성 회장단이 한 명만 남았는지. 마지막 회장단은 종료·강등할 수 없다.
create function private.is_last_executive(p_term_id uuid, p_membership_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.memberships m
    where m.term_id = p_term_id
      and m.role = 'EXECUTIVE'
      and m.is_active
      and m.id <> p_membership_id
  )
$$;

-- 부서에 이미 국장이 있는지 (활성 소속 또는 아직 활성화 전인 승인 행)
create function private.department_has_director(p_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.department_id = p_department_id and m.role = 'DIRECTOR' and m.is_active
  ) or exists (
    select 1 from public.approved_council_accounts a
    where a.department_id = p_department_id and a.role = 'DIRECTOR'
      and a.is_active and a.activated_user_id is null
  )
$$;

revoke all on function
  private.require_executive(uuid),
  private.is_last_executive(uuid, uuid),
  private.department_has_director(uuid)
from public;

-- ---------------------------------------------------------------------
-- 3. 승인 명단 일괄 등록 (D-18)
-- 행마다 검사해 오류 없는 행만 등록하고, 모든 행의 결과를 돌려준다.
-- 회장단: 모든 Role·부서 / 국장: 자기 국의 MEMBER만 (기획서 1.5)
-- p_rows: [{ "email", "student_no", "role", "department_id", "position_id" }]
-- ---------------------------------------------------------------------
create function public.register_approved_accounts(p_term_id uuid, p_rows jsonb)
returns table (row_no integer, email text, account_id uuid, error text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_my_role public.member_role;
  v_my_dept uuid;
  v_row jsonb;
  v_i integer := 0;
  v_email text;
  v_student text;
  v_role public.member_role;
  v_dept uuid;
  v_pos uuid;
  v_err text;
  v_id uuid;
begin
  select cm.role, cm.department_id
    into v_my_role, v_my_dept
  from private.current_membership(p_term_id) cm;

  if v_my_role is null or v_my_role = 'MEMBER' then
    raise exception '승인 명단을 등록할 권한이 없습니다.' using errcode = '42501';
  end if;

  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception '등록할 행 목록이 배열이 아닙니다.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_rows) > 200 then
    raise exception '한 번에 200행까지 등록할 수 있습니다.' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    v_err := null;
    v_id := null;
    v_role := null;
    v_dept := null;
    v_pos := null;
    v_email := lower(trim(coalesce(v_row ->> 'email', '')));
    v_student := trim(coalesce(v_row ->> 'student_no', ''));

    begin
      v_role := coalesce(nullif(v_row ->> 'role', ''), 'MEMBER')::public.member_role;
      v_dept := nullif(v_row ->> 'department_id', '')::uuid;
      v_pos := nullif(v_row ->> 'position_id', '')::uuid;
    exception when invalid_text_representation then
      v_err := 'Role 또는 부서·직책 값의 형식이 올바르지 않습니다.';
    end;

    if v_err is null and not private.is_school_email(v_email) then
      v_err := '학교 이메일이 아닙니다.';
    elsif v_err is null and v_student !~ '^[0-9]{10}$' then
      v_err := '학번은 숫자 10자리여야 합니다.';
    elsif v_err is null and v_my_role = 'DIRECTOR'
          and (v_role <> 'MEMBER' or v_dept is distinct from v_my_dept) then
      v_err := '국장은 자기 국의 국원(MEMBER)만 등록할 수 있습니다.';
    elsif v_err is null and v_role <> 'EXECUTIVE' and v_dept is null then
      v_err := '회장단이 아니면 부서가 필요합니다.';
    elsif v_err is null and v_dept is not null and not exists (
      select 1 from public.departments d
      where d.id = v_dept and d.term_id = p_term_id and d.is_active
    ) then
      v_err := '이 기수에서 사용 중인 부서가 아닙니다.';
    elsif v_err is null and v_pos is not null and not exists (
      select 1 from public.positions p
      where p.id = v_pos and p.term_id = p_term_id and p.is_active
    ) then
      v_err := '이 기수에서 사용 중인 직책이 아닙니다.';
    elsif v_err is null and v_role = 'DIRECTOR' and private.department_has_director(v_dept) then
      v_err := '이 부서에는 이미 국장이 있습니다.';
    elsif v_err is null and exists (
      select 1 from public.approved_council_accounts a
      where a.term_id = p_term_id and a.email = v_email
    ) then
      v_err := '이미 승인 명단에 있는 이메일입니다.';
    elsif v_err is null and exists (
      select 1 from public.approved_council_accounts a
      where a.term_id = p_term_id and a.student_no = v_student
    ) then
      v_err := '이미 등록된 학번입니다.';
    end if;

    if v_err is null then
      insert into public.approved_council_accounts (
        term_id, email, student_no, role, department_id, position_id, registered_by
      ) values (
        p_term_id, v_email, v_student, v_role, v_dept, v_pos, (select auth.uid())
      )
      returning id into v_id;
    end if;

    row_no := v_i;
    email := v_email;
    account_id := v_id;
    error := v_err;
    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. 승인 행 수정·취소 (활성화 전), 학번 정정 (언제든)
-- ---------------------------------------------------------------------

-- 승인 행을 고칠 수 있는 사람인지 검사하고 행을 잠근다.
create function private.lock_manageable_account(p_account_id uuid)
returns public.approved_council_accounts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.approved_council_accounts%rowtype;
  v_my_role public.member_role;
  v_my_dept uuid;
begin
  select * into v_account
  from public.approved_council_accounts
  where id = p_account_id
  for update;

  if not found then
    raise exception '승인 행을 찾을 수 없습니다.' using errcode = '42501';
  end if;

  select cm.role, cm.department_id into v_my_role, v_my_dept
  from private.current_membership(v_account.term_id) cm;

  if v_my_role = 'EXECUTIVE'
     or (v_my_role = 'DIRECTOR' and v_account.role = 'MEMBER'
         and v_account.department_id = v_my_dept) then
    return v_account;
  end if;

  raise exception '이 승인 행을 고칠 권한이 없습니다.' using errcode = '42501';
end;
$$;

revoke all on function private.lock_manageable_account(uuid) from public;

-- Role·부서·직책 수정은 활성화 전에만. 활성화 뒤에는 change_member_role을 쓴다.
create function public.update_approved_account(
  p_account_id uuid,
  p_role public.member_role,
  p_department_id uuid,
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

create function public.cancel_approved_account(p_account_id uuid)
returns public.approved_council_accounts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.approved_council_accounts%rowtype := private.lock_manageable_account(p_account_id);
begin
  if v_account.activated_user_id is not null then
    raise exception '이미 활성화된 계정입니다. 소속 종료는 구성원 관리에서 합니다.' using errcode = '55000';
  end if;

  update public.approved_council_accounts
    set is_active = false
  where id = p_account_id
  returning * into v_account;

  return v_account;
end;
$$;

create function public.set_approved_student_no(p_account_id uuid, p_student_no text)
returns public.approved_council_accounts
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.approved_council_accounts%rowtype := private.lock_manageable_account(p_account_id);
begin
  if trim(coalesce(p_student_no, '')) !~ '^[0-9]{10}$' then
    raise exception '학번은 숫자 10자리여야 합니다.' using errcode = '22023';
  end if;

  update public.approved_council_accounts
    set student_no = trim(p_student_no)
  where id = p_account_id
  returning * into v_account;

  return v_account;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. 소속 종료와 Role 변경 (기획서 1.5, 2.3)
-- 기록은 지우지 않고 is_active·left_at으로 종료한다.
-- ---------------------------------------------------------------------
create function public.end_membership(p_membership_id uuid)
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

  update public.memberships
    set is_active = false,
        left_at = now()
  where id = p_membership_id
  returning * into v_m;

  return v_m;
end;
$$;

-- 승격·강등·부서 이동·직책 변경은 회장단만 (기획서 2.3)
create function public.change_member_role(
  p_membership_id uuid,
  p_role public.member_role,
  p_department_id uuid,
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

-- ---------------------------------------------------------------------
-- 6. 부서·직책 관리 (회장단만, D-17)
-- 이름은 기수 안에서 유일하다. 연결된 사람이 있으면 비활성화하지 않는다.
-- ---------------------------------------------------------------------
create function public.create_department(p_term_id uuid, p_name text, p_sort_order integer default 0)
returns public.departments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.departments%rowtype;
begin
  perform private.require_executive(p_term_id);

  insert into public.departments (term_id, name, sort_order)
  values (p_term_id, trim(p_name), coalesce(p_sort_order, 0))
  returning * into v_row;

  return v_row;
end;
$$;

create function public.update_department(p_department_id uuid, p_name text, p_sort_order integer)
returns public.departments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.departments%rowtype;
begin
  select * into v_row from public.departments where id = p_department_id for update;
  if not found then
    raise exception '부서를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_row.term_id);

  update public.departments
    set name = trim(p_name),
        sort_order = coalesce(p_sort_order, sort_order)
  where id = p_department_id
  returning * into v_row;

  return v_row;
end;
$$;

create function public.set_department_active(p_department_id uuid, p_active boolean)
returns public.departments
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.departments%rowtype;
  v_members integer;
  v_pending integer;
begin
  select * into v_row from public.departments where id = p_department_id for update;
  if not found then
    raise exception '부서를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_row.term_id);

  if not p_active then
    select count(*) into v_members
    from public.memberships m
    where m.department_id = p_department_id and m.is_active;

    select count(*) into v_pending
    from public.approved_council_accounts a
    where a.department_id = p_department_id and a.is_active and a.activated_user_id is null;

    if v_members + v_pending > 0 then
      raise exception '연결된 구성원 %명, 활성화 전 승인 %건이 있어 비활성화할 수 없습니다.', v_members, v_pending
        using errcode = '55000';
    end if;
  end if;

  update public.departments set is_active = p_active
  where id = p_department_id
  returning * into v_row;

  return v_row;
end;
$$;

create function public.create_position(p_term_id uuid, p_name text, p_sort_order integer default 0)
returns public.positions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.positions%rowtype;
begin
  perform private.require_executive(p_term_id);

  insert into public.positions (term_id, name, sort_order)
  values (p_term_id, trim(p_name), coalesce(p_sort_order, 0))
  returning * into v_row;

  return v_row;
end;
$$;

create function public.update_position(p_position_id uuid, p_name text, p_sort_order integer)
returns public.positions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.positions%rowtype;
begin
  select * into v_row from public.positions where id = p_position_id for update;
  if not found then
    raise exception '직책을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_row.term_id);

  update public.positions
    set name = trim(p_name),
        sort_order = coalesce(p_sort_order, sort_order)
  where id = p_position_id
  returning * into v_row;

  return v_row;
end;
$$;

create function public.set_position_active(p_position_id uuid, p_active boolean)
returns public.positions
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.positions%rowtype;
  v_members integer;
  v_pending integer;
begin
  select * into v_row from public.positions where id = p_position_id for update;
  if not found then
    raise exception '직책을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_row.term_id);

  if not p_active then
    select count(*) into v_members
    from public.memberships m
    where m.position_id = p_position_id and m.is_active;

    select count(*) into v_pending
    from public.approved_council_accounts a
    where a.position_id = p_position_id and a.is_active and a.activated_user_id is null;

    if v_members + v_pending > 0 then
      raise exception '연결된 구성원 %명, 활성화 전 승인 %건이 있어 비활성화할 수 없습니다.', v_members, v_pending
        using errcode = '55000';
    end if;
  end if;

  update public.positions set is_active = p_active
  where id = p_position_id
  returning * into v_row;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 7. 실행 권한: 로그인 사용자만. 함수 안에서 Role을 다시 검사한다.
-- ---------------------------------------------------------------------
revoke all on function
  public.register_approved_accounts(uuid, jsonb),
  public.update_approved_account(uuid, public.member_role, uuid, uuid),
  public.cancel_approved_account(uuid),
  public.set_approved_student_no(uuid, text),
  public.end_membership(uuid),
  public.change_member_role(uuid, public.member_role, uuid, uuid),
  public.create_department(uuid, text, integer),
  public.update_department(uuid, text, integer),
  public.set_department_active(uuid, boolean),
  public.create_position(uuid, text, integer),
  public.update_position(uuid, text, integer),
  public.set_position_active(uuid, boolean)
from public, anon;

grant execute on function
  public.register_approved_accounts(uuid, jsonb),
  public.update_approved_account(uuid, public.member_role, uuid, uuid),
  public.cancel_approved_account(uuid),
  public.set_approved_student_no(uuid, text),
  public.end_membership(uuid),
  public.change_member_role(uuid, public.member_role, uuid, uuid),
  public.create_department(uuid, text, integer),
  public.update_department(uuid, text, integer),
  public.set_department_active(uuid, boolean),
  public.create_position(uuid, text, integer),
  public.update_position(uuid, text, integer),
  public.set_position_active(uuid, boolean)
to authenticated;
