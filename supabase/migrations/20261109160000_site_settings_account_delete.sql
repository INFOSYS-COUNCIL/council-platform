-- 학생회 이름 설정(첫 화면·사이드바·탭 제목의 "<이름> 운영 플랫폼")과
-- 활성화 전 승인 행 삭제.

-- ---------------------------------------------------------------------
-- 1. 사이트 설정: 한 줄짜리 전역 설정. 첫 화면은 로그인 전에도 이름을 보여 주므로 누구나 읽는다.
-- ---------------------------------------------------------------------
create table public.site_settings (
  id boolean primary key default true constraint site_settings_singleton check (id),
  council_name text not null default '학생회',
  updated_at timestamptz not null default now(),

  constraint site_settings_council_name_length check (length(trim(council_name)) between 1 and 30)
);

insert into public.site_settings default values;

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function private.set_updated_at();

alter table public.site_settings enable row level security;

grant select on public.site_settings to anon, authenticated;

create policy site_settings_select_all
  on public.site_settings for select
  to anon, authenticated
  using (true);

-- 쓰기는 ACTIVE 기수 회장단만, 이 함수로만
create function public.set_council_name(p_name text)
returns public.site_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.site_settings%rowtype;
begin
  if not private.is_executive(private.active_term_id()) then
    raise exception '회장단만 학생회 이름을 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  begin
    update public.site_settings
      set council_name = trim(p_name)
    where id
    returning * into v_row;
  exception when check_violation or not_null_violation then
    raise exception '학생회 이름은 1~30자로 입력해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. 승인 행 삭제: 아직 로그인하지 않은 행(대기·등록 취소)만. 같은 이메일을 다시 등록할 수 있게 한다.
--    로그인한 행은 소속(memberships)이 참조하므로 지우지 않고, 소속 종료는 구성원 관리에서 한다.
-- ---------------------------------------------------------------------
create function public.delete_approved_account(p_account_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account public.approved_council_accounts%rowtype := private.lock_manageable_account(p_account_id);
begin
  if v_account.activated_user_id is not null then
    raise exception '이미 로그인한 계정은 삭제할 수 없습니다. 소속 종료는 구성원 관리에서 합니다.' using errcode = '55000';
  end if;

  delete from public.approved_council_accounts where id = p_account_id;
end;
$$;

revoke all on function
  public.set_council_name(text),
  public.delete_approved_account(uuid)
from public, anon;

grant execute on function
  public.set_council_name(text),
  public.delete_approved_account(uuid)
to authenticated;
