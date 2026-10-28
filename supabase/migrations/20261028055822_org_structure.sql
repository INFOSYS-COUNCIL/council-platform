-- 1차 Migration: 기수(terms)와 기수별 부서(departments)·직책(positions)
-- 기준: 기획서 v0.7 8.1절, 9.2절, 부록 B

create type public.term_status as enum ('DRAFT', 'ACTIVE', 'CLOSED');

-- 기수 ---------------------------------------------------------------
create table public.terms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  status public.term_status not null default 'DRAFT',
  starts_on date,
  ends_on date,
  created_at timestamptz not null default now(),
  constraint terms_dates_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

comment on table public.terms is '학생회 기수. ACTIVE는 한 번에 하나만 둔다.';

-- 한 시점에 ACTIVE 기수는 하나만 (부분 유일 Index)
create unique index terms_single_active
  on public.terms ((true))
  where status = 'ACTIVE';

-- 부서 ---------------------------------------------------------------
-- 부서명은 코드에 고정하지 않는다. 사무국·재무국 등은 Seed일 뿐이다.
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint departments_term_name_key unique (term_id, name),
  -- memberships가 (term_id, department_id) 복합 FK로 같은 기수를 강제할 때 사용
  constraint departments_term_id_id_key unique (term_id, id)
);

comment on table public.departments is '기수별 부서. 새 기수는 빈 상태로 시작한다.';

-- 직책 ---------------------------------------------------------------
-- 화면 표시용이다. 권한 판정에는 쓰지 않는다(권한은 memberships.role).
create table public.positions (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint positions_term_name_key unique (term_id, name),
  constraint positions_term_id_id_key unique (term_id, id)
);

comment on table public.positions is '기수별 표시 직책. 권한 판정에 사용하지 않는다.';

-- RLS ----------------------------------------------------------------
-- 정책이 없으면 anon·authenticated는 아무 행도 읽거나 쓰지 못한다.
-- 구성원 조회 정책은 memberships가 생기는 2차 Migration에서 추가한다.
alter table public.terms enable row level security;
alter table public.departments enable row level security;
alter table public.positions enable row level security;

-- terms는 클라이언트의 직접 쓰기를 금지하고 RPC로만 바꾼다(기획서 9.2절).
revoke insert, update, delete, truncate on public.terms from anon, authenticated;
