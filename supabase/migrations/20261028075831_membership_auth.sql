-- 2차 Migration: 사용자 Profile, 승인 명단, 기수별 소속(Membership)과 RLS
-- 기준: 기획서 v0.7 1.2절, 2절, 8.1절, 9.2절, 10.4절

-- ---------------------------------------------------------------------
-- 0. 테이블 권한 기본값
-- 원격 프로젝트는 "Automatically expose new tables"를 끈 상태로 만들었다.
-- 로컬도 같은 조건이 되도록 public 스키마의 기본 권한을 없애고,
-- 테이블마다 필요한 권한만 직접 GRANT한다.
-- ---------------------------------------------------------------------
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;

-- 1차 Migration 테이블도 같은 기준으로 맞춘다.
revoke all on public.terms, public.departments, public.positions from anon, authenticated;
grant select on public.terms, public.departments, public.positions to authenticated;
grant all on public.terms, public.departments, public.positions to service_role;

-- ---------------------------------------------------------------------
-- 1. private 스키마: 권한 판정 함수를 둔다. API로 노출되지 않는다.
-- ---------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- 학교 도메인 설정. 바꿀 일이 있으면 이 함수만 새 Migration으로 교체한다.
create function private.school_email_domain()
returns text
language sql
immutable
set search_path = ''
as $$ select 'hanyang.ac.kr' $$;

-- Google ID Token의 hd(Workspace 도메인) 클레임을 필수로 볼지.
-- 실제 학교 계정으로 테스트 로그인해 hd가 들어오는지 확인한 뒤 확정한다.
create function private.require_google_hd()
returns boolean
language sql
immutable
set search_path = ''
as $$ select true $$;

-- 이메일이 정확히 학교 도메인인지 검사한다. (하위 도메인, 꼬리 붙이기 거부)
create function private.is_school_email(p_email text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    lower(trim(p_email)) ~ '^[^@[:space:]]+@[^@[:space:]]+$'
    and split_part(lower(trim(p_email)), '@', 2) = private.school_email_domain(),
    false
  )
$$;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Role
-- STUDENT는 저장하지 않는다. 활성 Membership이 없는 로그인 사용자의 상태다.
-- ---------------------------------------------------------------------
create type public.member_role as enum ('MEMBER', 'DIRECTOR', 'EXECUTIVE');

-- ---------------------------------------------------------------------
-- 3. profiles: auth.users와 1:1. 생성은 트리거만 한다(다음 Migration).
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  email text not null unique,
  display_name text check (display_name is null or length(trim(display_name)) between 1 and 50),
  student_no text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized check (email = lower(trim(email)))
);

comment on table public.profiles is '사용자 기본 정보. 사용자가 직접 바꿀 수 있는 열은 display_name뿐이다.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. approved_council_accounts: 학생회 내부 권한의 Allowlist
-- ---------------------------------------------------------------------
create table public.approved_council_accounts (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  email text not null,
  role public.member_role not null,
  department_id uuid,
  position_id uuid,
  registered_by uuid references public.profiles (id) on delete restrict,
  activated_user_id uuid references public.profiles (id) on delete restrict,
  activated_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint approved_email_school check (
    email = lower(trim(email)) and private.is_school_email(email)
  ),
  -- 회장단이 아니면 부서 필수
  constraint approved_department_required check (role = 'EXECUTIVE' or department_id is not null),
  -- 연결 정보는 함께 채워진다
  constraint approved_activation_pair check ((activated_user_id is null) = (activated_at is null)),
  -- (기수, 승인 이메일) 유일
  constraint approved_term_email_key unique (term_id, email),
  -- 한 사용자는 한 기수에 승인 행 하나에만 연결된다
  constraint approved_term_user_key unique (term_id, activated_user_id),
  constraint approved_term_id_id_key unique (term_id, id),
  -- 부서·직책은 같은 기수의 것이어야 한다
  constraint approved_department_same_term foreign key (term_id, department_id)
    references public.departments (term_id, id) on delete restrict,
  constraint approved_position_same_term foreign key (term_id, position_id)
    references public.positions (term_id, id) on delete restrict
);

comment on table public.approved_council_accounts is
  '회장단·국장이 사전 승인한 학교 계정. 첫 로그인 때 activate_membership()이 Membership으로 연결한다.';

-- ---------------------------------------------------------------------
-- 5. memberships: 기수별 소속과 보안 Role
-- ---------------------------------------------------------------------
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  user_id uuid not null references public.profiles (id) on delete restrict,
  role public.member_role not null,
  department_id uuid,
  position_id uuid,
  approved_account_id uuid,
  is_active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,

  constraint memberships_department_required check (role = 'EXECUTIVE' or department_id is not null),
  -- 활성이면 left_at 없음, 종료면 left_at 있음
  constraint memberships_active_state check (is_active = (left_at is null)),
  -- 승인 행 하나로 Membership은 한 번만 만든다. 종료 후 같은 승인으로 되살리지 않는다.
  constraint memberships_approved_account_key unique (approved_account_id),
  constraint memberships_department_same_term foreign key (term_id, department_id)
    references public.departments (term_id, id) on delete restrict,
  constraint memberships_position_same_term foreign key (term_id, position_id)
    references public.positions (term_id, id) on delete restrict,
  constraint memberships_approved_same_term foreign key (term_id, approved_account_id)
    references public.approved_council_accounts (term_id, id) on delete restrict
);

comment on table public.memberships is
  '기수별 소속. role은 보안 권한, position_id는 표시 직책이다. 직접 쓰기 금지, 함수로만 변경한다.';
comment on column public.memberships.role is '권한 판정 기준. Position 이름으로 권한을 판단하지 않는다.';

-- 동일 사용자·기수의 활성 소속은 하나
create unique index memberships_one_active_per_term
  on public.memberships (term_id, user_id)
  where is_active;

-- 한 부서의 활성 국장은 1명 (기획서 1.2절, MVP)
create unique index memberships_one_active_director
  on public.memberships (department_id)
  where is_active and role = 'DIRECTOR';

create index memberships_user_active on public.memberships (user_id) where is_active;

-- ---------------------------------------------------------------------
-- 6. 권한 판정 함수 (RLS에서 공유)
-- SECURITY DEFINER로 memberships의 RLS를 다시 타지 않게 한다.
-- ---------------------------------------------------------------------

-- 현재 사용자의 해당 기수 Role. 접근할 수 없으면 null.
-- ACTIVE 기수는 활성 구성원 전체, DRAFT 기수는 EXECUTIVE만, CLOSED는 아무도 (기획서 8.1절)
create function private.member_role(p_term_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.memberships m
  join public.terms t on t.id = m.term_id
  where m.term_id = p_term_id
    and m.user_id = (select auth.uid())
    and m.is_active
    and (t.status = 'ACTIVE' or (t.status = 'DRAFT' and m.role = 'EXECUTIVE'))
$$;

create function private.member_department(p_term_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.department_id
  from public.memberships m
  join public.terms t on t.id = m.term_id
  where m.term_id = p_term_id
    and m.user_id = (select auth.uid())
    and m.is_active
    and (t.status = 'ACTIVE' or (t.status = 'DRAFT' and m.role = 'EXECUTIVE'))
$$;

create function private.is_member(p_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.member_role(p_term_id) is not null $$;

create function private.is_executive(p_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(private.member_role(p_term_id) = 'EXECUTIVE', false) $$;

-- 같은 기수 활성 구성원끼리는 서로의 Profile(이름·이메일)을 볼 수 있다.
create function private.can_view_profile(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user_id = (select auth.uid())
    or exists (
      select 1
      from public.memberships m
      where m.user_id = p_user_id
        and m.is_active
        and private.is_member(m.term_id)
    )
$$;

revoke all on function
  private.school_email_domain(),
  private.require_google_hd(),
  private.is_school_email(text),
  private.member_role(uuid),
  private.member_department(uuid),
  private.is_member(uuid),
  private.is_executive(uuid),
  private.can_view_profile(uuid)
from public;

grant execute on function
  private.school_email_domain(),
  private.is_school_email(text),
  private.member_role(uuid),
  private.member_department(uuid),
  private.is_member(uuid),
  private.is_executive(uuid),
  private.can_view_profile(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 7. 테이블 권한과 RLS
-- memberships·approved_council_accounts·terms는 클라이언트 직접 쓰기 금지 (기획서 9.2절)
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.approved_council_accounts enable row level security;
alter table public.memberships enable row level security;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.approved_council_accounts to authenticated;
grant select on public.memberships to authenticated;
grant all on public.profiles, public.approved_council_accounts, public.memberships to service_role;

-- terms: ACTIVE 기수는 로그인 사용자 누구나(건의 작성 등), 그 외는 접근 가능한 구성원만
create policy "terms: active term or own term"
  on public.terms for select
  to authenticated
  using (status = 'ACTIVE' or private.is_member(id));

create policy "departments: members of the term"
  on public.departments for select
  to authenticated
  using (private.is_member(term_id));

create policy "positions: members of the term"
  on public.positions for select
  to authenticated
  using (private.is_member(term_id));

create policy "profiles: self or same-term members"
  on public.profiles for select
  to authenticated
  using (private.can_view_profile(id));

create policy "profiles: update own display name"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "memberships: self or same-term members"
  on public.memberships for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_member(term_id));

-- 승인 명단: 회장단은 기수 전체, 국장은 자기 국만
create policy "approved accounts: executives or own-department director"
  on public.approved_council_accounts for select
  to authenticated
  using (
    private.is_executive(term_id)
    or (
      private.member_role(term_id) = 'DIRECTOR'
      and department_id = private.member_department(term_id)
    )
  );
