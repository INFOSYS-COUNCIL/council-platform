-- 일정 메모: schedules.description(최대 2000자)을 수정할 때도 바꿀 수 있게 update_schedule에 p_description을 더한다.
-- 매개변수가 늘어 시그니처가 바뀌므로 지우고 다시 만든다(권한 규칙은 20261111140000과 같다).

drop function public.update_schedule(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text);

create function public.update_schedule(
  p_schedule_id uuid,
  p_title text,
  p_is_all_day boolean,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_start_date date,
  p_end_date date,
  p_location text default '',
  p_color text default 'coral',
  p_description text default ''
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
  if not private.can_change_schedule(v_row) then
    raise exception '만든 사람이나 관리 권한이 있는 사람만 고칠 수 있습니다.' using errcode = '42501';
  end if;

  begin
    update public.schedules
    set title = trim(p_title),
        location = coalesce(trim(p_location), ''),
        description = coalesce(trim(p_description), ''),
        is_all_day = coalesce(p_is_all_day, false),
        starts_at = case when not coalesce(p_is_all_day, false) then p_starts_at end,
        ends_at = case when not coalesce(p_is_all_day, false) then p_ends_at end,
        start_date = case when coalesce(p_is_all_day, false) then p_start_date end,
        end_date = case when coalesce(p_is_all_day, false) then p_end_date end,
        color = coalesce(p_color, 'coral')
    where id = p_schedule_id
    returning * into v_row;
  exception when check_violation then
    raise exception '제목(1~100자), 메모(2000자 이하), 시작·종료(종료는 시작 이후), 색을 확인해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

revoke execute on function
  public.update_schedule(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, text)
from public, anon;
grant execute on function
  public.update_schedule(uuid, text, boolean, timestamptz, timestamptz, date, date, text, text, text)
to authenticated;
