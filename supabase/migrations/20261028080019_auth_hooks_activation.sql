-- 3차 Migration: 학교 계정 차단(Auth Hook), Profile 생성, Membership 활성화, 첫 회장단 등록
-- 기준: 기획서 v0.7 2.1절, 2.2절

-- ---------------------------------------------------------------------
-- 1. Before User Created Hook
-- auth.users 행이 만들어지기 전에 학교 Google 계정이 아니면 거부한다.
-- Supabase 대시보드 Authentication → Hooks에서 이 함수를 연결해야 동작한다.
-- (로컬은 supabase/config.toml의 [auth.hook.before_user_created])
-- ---------------------------------------------------------------------
create function public.hook_before_user_created(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user jsonb := event -> 'user';
  v_email text := lower(trim(v_user ->> 'email'));
  v_provider text := v_user -> 'app_metadata' ->> 'provider';
  v_hd text := lower(v_user -> 'user_metadata' -> 'custom_claims' ->> 'hd');
  v_verified boolean :=
    coalesce((v_user -> 'user_metadata' ->> 'email_verified')::boolean, false)
    or (v_user ->> 'email_confirmed_at') is not null;
begin
  if v_provider is distinct from 'google' then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', 'Google 계정으로만 로그인할 수 있습니다.'));
  end if;

  if not v_verified then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '이메일 인증이 완료된 Google 계정만 사용할 수 있습니다.'));
  end if;

  if not private.is_school_email(v_email) then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '학교 계정(@' || private.school_email_domain() || ')으로만 로그인할 수 있습니다.'));
  end if;

  -- 이메일 문자열만으로 Workspace 소속을 단정하지 않는다 (기획서 2.1절)
  if private.require_google_hd() and v_hd is distinct from private.school_email_domain() then
    return jsonb_build_object('error', jsonb_build_object(
      'http_code', 403,
      'message', '학교 Google Workspace 계정으로만 로그인할 수 있습니다.'));
  end if;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

-- ---------------------------------------------------------------------
-- 2. Profile 생성 트리거
-- Hook 설정 누락이나 다른 Provider 추가로 우회되지 않도록 같은 조건을 다시 검사한다.
-- 역할(Role)은 여기서 받지 않는다.
-- ---------------------------------------------------------------------
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     or not private.is_school_email(new.email) then
    raise exception '학교 Google 계정만 가입할 수 있습니다.'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(trim(new.email)),
    -- 표시용 이름일 뿐 권한 판단에는 쓰지 않는다
    nullif(left(trim(new.raw_user_meta_data ->> 'full_name'), 50), '')
  );

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- 3. activate_membership()
-- 로그인한 사용자의 승인 행을 찾아 Membership을 만든다.
-- - 한 트랜잭션에서 처리하고, 여러 번 호출해도 결과가 같다(멱등).
-- - 이미 다른 사용자에게 연결된 승인 행은 다시 연결하지 않는다.
-- - 승인 명단에 없는 학교 계정은 아무것도 만들지 않는다(일반 학생).
-- ---------------------------------------------------------------------
create function public.activate_membership()
returns setof public.memberships
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_account public.approved_council_accounts%rowtype;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;

  -- 검증된 이메일은 profiles(사용자가 바꿀 수 없음)와 auth.users에서만 읽는다.
  -- user_metadata처럼 사용자가 수정할 수 있는 값은 근거로 쓰지 않는다.
  select p.email
    into v_email
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.id = v_uid
    and u.email_confirmed_at is not null
    and u.raw_app_meta_data ->> 'provider' = 'google';

  if v_email is null or not private.is_school_email(v_email) then
    raise exception '학교 Google 계정으로 로그인해야 합니다.' using errcode = '42501';
  end if;

  for v_account in
    select a.*
    from public.approved_council_accounts a
    join public.terms t on t.id = a.term_id
    where a.email = v_email
      and a.is_active
      and a.activated_user_id is null
      and (t.status = 'ACTIVE' or (t.status = 'DRAFT' and a.role = 'EXECUTIVE'))
    for update of a
  loop
    update public.approved_council_accounts
      set activated_user_id = v_uid,
          activated_at = now()
    where id = v_account.id;

    insert into public.memberships (
      term_id, user_id, role, department_id, position_id, approved_account_id
    ) values (
      v_account.term_id, v_uid, v_account.role,
      v_account.department_id, v_account.position_id, v_account.id
    )
    on conflict do nothing;
  end loop;

  return query
    select m.*
    from public.memberships m
    where m.user_id = v_uid
      and m.is_active;
end;
$$;

revoke all on function public.activate_membership() from public, anon;
grant execute on function public.activate_membership() to authenticated;

-- ---------------------------------------------------------------------
-- 4. 첫 회장단 등록 (비상 절차, 기획서 2.2절)
-- 기수에 회장단이 아무도 없을 때 한 번만 쓴다. 대시보드 SQL Editor(postgres)에서만 실행된다.
-- 실제 이메일은 실행할 때 인자로 넣고, 저장소에는 적지 않는다.
--   select private.bootstrap_first_executive('<기수 id>', '<학교 이메일>');
-- 등록 후 해당 사용자가 로그인하면 activate_membership()이 Membership을 만든다.
-- ---------------------------------------------------------------------
create function private.bootstrap_first_executive(
  p_term_id uuid,
  p_email text,
  p_position_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_id uuid;
begin
  if not private.is_school_email(v_email) then
    raise exception '학교 이메일이 아닙니다: %', v_email;
  end if;

  if not exists (
    select 1 from public.terms
    where id = p_term_id and status in ('DRAFT', 'ACTIVE')
  ) then
    raise exception 'DRAFT 또는 ACTIVE 기수가 아닙니다: %', p_term_id;
  end if;

  if exists (
    select 1 from public.approved_council_accounts
    where term_id = p_term_id and role = 'EXECUTIVE' and is_active
  ) or exists (
    select 1 from public.memberships
    where term_id = p_term_id and role = 'EXECUTIVE' and is_active
  ) then
    raise exception '이 기수에는 이미 회장단이 있습니다. 추가 등록은 회장단 화면에서 합니다.';
  end if;

  insert into public.approved_council_accounts (term_id, email, role, position_id)
  values (p_term_id, v_email, 'EXECUTIVE', p_position_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function private.bootstrap_first_executive(uuid, text, uuid)
  from public, anon, authenticated, service_role;
