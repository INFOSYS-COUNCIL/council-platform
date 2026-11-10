-- 2차 사용 피드백: 일정 수정. 지울 수 있는 사람(만든 사람, 회장단, 행사 관리자)만 고칠 수 있다.
-- 행사·기수는 바꾸지 않는다(옮기려면 지우고 다시 만든다).

create function public.update_schedule(
  p_schedule_id uuid,
  p_title text,
  p_is_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date date,
  p_location text default '',
  p_color text default 'coral'
)
returns public.schedules
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.schedules%rowtype;
begin
  select * into v_row from public.schedules where id = p_schedule_id for update;
  if not found or not private.can_view_schedule_values(v_row.term_id, v_row.event_id) then
    raise exception '일정을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  if v_row.created_by is distinct from (select auth.uid())
     and not private.is_executive(v_row.term_id)
     and not (v_row.event_id is not null and exists (
       select 1 from public.events e where e.id = v_row.event_id and private.can_manage_event(e))) then
    raise exception '만든 사람이나 관리 권한이 있는 사람만 고칠 수 있습니다.' using errcode = '42501';
  end if;

  begin
    update public.schedules
    set title = trim(p_title),
        location = coalesce(trim(p_location), ''),
        is_all_day = coalesce(p_is_all_day, false),
        starts_at = case when not coalesce(p_is_all_day, false) then p_starts_at end,
        ends_at = case when not coalesce(p_is_all_day, false) then p_ends_at end,
        start_date = case when coalesce(p_is_all_day, false) then p_start_date end,
        end_date = case when coalesce(p_is_all_day, false) then p_end_date end,
        color = coalesce(p_color, 'coral')
    where id = p_schedule_id
    returning * into v_row;
  exception when check_violation then
    raise exception '제목(1~100자), 시작·종료(종료는 시작 이후), 색을 확인해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

revoke execute on function
  public.update_schedule(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text)
from public, anon;
grant execute on function
  public.update_schedule(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text)
to authenticated;
