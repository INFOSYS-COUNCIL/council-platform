-- 1차 사용 피드백 반영
-- 1. 일정 색(구분용)
-- 2. 바로가기 수정
-- 3. 회의록 Template 삭제(쓴 회의록이 없을 때만)
-- 4. 보관된 회의록: 회장단 또는 국장 이상인 대표 작성자가 다시 편집으로 돌리거나 삭제

-- ---------------------------------------------------------------------
-- 1. 일정 색
-- ---------------------------------------------------------------------
alter table public.schedules
  add column color text not null default 'coral'
  constraint schedules_color_check check (color in ('coral', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'));

-- 인자가 늘어나므로 다시 만든다. 본문은 20261109120000과 같고 색만 더한다.
drop function public.create_schedule(uuid, uuid, text, boolean, timestamptz, timestamptz, date, date, text, text);

create function public.create_schedule(
  p_term_id uuid,
  p_event_id uuid,
  p_title text,
  p_is_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date date,
  p_location text default '',
  p_description text default '',
  p_color text default 'coral'
)
returns public.schedules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_role public.member_role;
  v_event public.events%rowtype;
  v_row public.schedules%rowtype;
begin
  if p_event_id is null then
    select cm.role into v_role from private.current_membership(p_term_id) cm;
    if v_role is null or v_role = 'MEMBER' then
      raise exception '국장과 회장단만 기수 일정을 만들 수 있습니다.' using errcode = '42501';
    end if;
  else
    v_event := private.lock_visible_event(p_event_id);
    if v_event.term_id is distinct from p_term_id then
      raise exception '행사를 찾을 수 없습니다.' using errcode = '42501';
    end if;
    perform private.require_manage_event(v_event);
  end if;

  begin
    insert into public.schedules (
      term_id, event_id, title, description, location, is_all_day,
      starts_at, ends_at, start_date, end_date, created_by, color)
    values (
      p_term_id, p_event_id, trim(p_title), coalesce(p_description, ''), coalesce(trim(p_location), ''),
      coalesce(p_is_all_day, false),
      case when not coalesce(p_is_all_day, false) then p_starts_at end,
      case when not coalesce(p_is_all_day, false) then p_ends_at end,
      case when coalesce(p_is_all_day, false) then p_start_date end,
      case when coalesce(p_is_all_day, false) then p_end_date end,
      (select auth.uid()),
      coalesce(p_color, 'coral'))
    returning * into v_row;
  exception when check_violation then
    raise exception '제목(1~100자), 시작·종료(종료는 시작 이후), 색을 확인해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. 바로가기 수정: ACTIVE 기수 회장단만
-- ---------------------------------------------------------------------
create function public.update_dashboard_link(
  p_link_id uuid,
  p_name text,
  p_url text,
  p_description text default '',
  p_sort_order integer default 0
)
returns public.dashboard_links
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.dashboard_links%rowtype;
begin
  perform private.require_active_executive();
  begin
    update public.dashboard_links
      set name = trim(p_name), url = trim(p_url), description = coalesce(p_description, ''),
          sort_order = coalesce(p_sort_order, 0)
    where id = p_link_id
    returning * into v_row;
  exception when check_violation then
    raise exception '이름(1~50자)과 https:// 로 시작하는 주소를 확인해 주세요.' using errcode = '23514';
  end;
  if not found then
    raise exception '바로가기를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 회의록 Template 삭제: 그 기수 회장단만, 이 Template으로 만든 회의록이 없을 때만
-- ---------------------------------------------------------------------
create function public.delete_meeting_template(p_template_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_template public.meeting_templates%rowtype;
begin
  select * into v_template from public.meeting_templates where id = p_template_id for update;
  if not found then
    raise exception 'Template을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_template.term_id);
  if exists (select 1 from public.meeting_minutes m where m.template_id = p_template_id) then
    raise exception '이 템플릿으로 만든 회의록이 있어 삭제할 수 없습니다. 대신 사용 중지해 주세요.' using errcode = '55000';
  end if;
  delete from public.meeting_templates where id = p_template_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. 보관된 회의록 다시 편집·삭제
-- ---------------------------------------------------------------------

-- 보관된 회의록을 다룰 수 있는 사람: 회장단, 또는 국장 이상인 대표 작성자
create function private.can_handle_archived_meeting(p_meeting public.meeting_minutes)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_executive(p_meeting.term_id)
    or (p_meeting.author_id = (select auth.uid())
        and exists (
          select 1 from private.current_membership(p_meeting.term_id) cm
          where cm.role in ('DIRECTOR', 'EXECUTIVE')))
$$;

revoke all on function private.can_handle_archived_meeting(public.meeting_minutes) from public;
grant execute on function private.can_handle_archived_meeting(public.meeting_minutes) to authenticated, service_role;

-- 20261109140000의 규칙에 "보관 → 작성 중"을 국장 이상 대표 작성자에게도 허용한다.
-- CONFIRMED→DRAFT: 회장단만, 사유 필수 / DRAFT·CONFIRMED→ARCHIVED: 생성자·회장단
-- ARCHIVED→DRAFT: 회장단 또는 국장 이상 대표 작성자
create or replace function public.change_meeting_status(
  p_meeting_id uuid,
  p_status public.meeting_status,
  p_reason text default null
)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
  v_new public.meeting_minutes%rowtype;
  v_unarchive boolean := v_old.status = 'ARCHIVED' and p_status = 'DRAFT';
begin
  if v_unarchive then
    if not private.can_handle_archived_meeting(v_old) then
      raise exception '보관된 회의록은 회장단이나 국장 이상인 대표 작성자만 다시 열 수 있습니다.' using errcode = '42501';
    end if;
  else
    perform private.require_manage_meeting(v_old);
  end if;
  if p_status = 'CONFIRMED' then
    raise exception '확정은 확정 기능으로 해 주세요.' using errcode = '22023';
  end if;
  if p_status is null or p_status = v_old.status then
    raise exception '바꿀 상태를 선택해 주세요.' using errcode = '22023';
  end if;
  if p_status = 'DRAFT' and not v_unarchive and not private.is_executive(v_old.term_id) then
    raise exception '확정 해제와 보관 해제는 회장단만 할 수 있습니다.' using errcode = '42501';
  end if;
  if v_old.status = 'CONFIRMED' and p_status = 'DRAFT' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception '확정을 해제하는 사유를 입력해 주세요.' using errcode = '22023';
  end if;

  update public.meeting_minutes
    set status = p_status,
        confirmed_at = case when p_status = 'DRAFT' then null else confirmed_at end,
        confirmed_by = case when p_status = 'DRAFT' then null else confirmed_by end
  where id = p_meeting_id
  returning * into v_new;

  perform private.log_activity(v_new.term_id, 'MEETING', v_new.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_old.status),
    jsonb_strip_nulls(jsonb_build_object('status', v_new.status, 'reason', nullif(trim(p_reason), ''))));
  perform private.broadcast_meeting_status(v_new);
  return v_new;
end;
$$;

-- 보관된 회의록만 삭제한다(본문·편집자·열람 범위가 함께 지워진다). 활동 기록에는 남긴다.
create function public.delete_meeting(p_meeting_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
begin
  if v_old.status <> 'ARCHIVED' then
    raise exception '보관된 회의록만 삭제할 수 있습니다. 먼저 보관해 주세요.' using errcode = '55000';
  end if;
  if not private.can_handle_archived_meeting(v_old) then
    raise exception '보관된 회의록은 회장단이나 국장 이상인 대표 작성자만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.meeting_minutes where id = p_meeting_id;
  perform private.log_activity(v_old.term_id, 'MEETING', v_old.id, 'DELETE',
    jsonb_build_object('title', v_old.title), null);
end;
$$;

revoke all on function
  public.create_schedule(uuid, uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, text),
  public.update_dashboard_link(uuid, text, text, text, integer),
  public.delete_meeting_template(uuid),
  public.delete_meeting(uuid)
from public, anon;

grant execute on function
  public.create_schedule(uuid, uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, text),
  public.update_dashboard_link(uuid, text, text, text, integer),
  public.delete_meeting_template(uuid),
  public.delete_meeting(uuid)
to authenticated;
