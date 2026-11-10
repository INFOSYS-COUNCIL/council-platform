-- 3차 사용 피드백: 수정·삭제는 각 국 국장과 회장단만 한다.
--   일정: 회장단, 또는 국장(만든 사람이거나 행사 관리 권한이 있을 때)
--   건의 답변·메모: 회장단, 또는 그 건의를 맡은 국의 국장
--   건의 삭제(새로): 회장단, 또는 그 건의를 맡은 국의 국장
--   회의록 관리: 회장단, 또는 만든 국장 / 회의록 삭제: 상태와 관계없이 회장단, 또는 만든 사람·대표 작성자인 국장
-- 업무(can_manage_task)는 이미 회장단·국장만이라 그대로 둔다.

-- 지금 이 기수에서 국장 이상인지
create function private.is_director_or_above(p_term_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.current_membership(p_term_id) cm
    where cm.role in ('DIRECTOR', 'EXECUTIVE')
  )
$$;

-- ---------------------------------------------------------------------
-- 1. 일정 수정·삭제
-- ---------------------------------------------------------------------
create function private.can_change_schedule(p_row public.schedules)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_executive(p_row.term_id)
    or (private.is_director_or_above(p_row.term_id) and (
      p_row.created_by = (select auth.uid())
      or (p_row.event_id is not null and exists (
        select 1 from public.events e where e.id = p_row.event_id and private.can_manage_event(e)))
    ))
$$;

create or replace function public.delete_schedule(p_schedule_id uuid)
returns void
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
    raise exception '만든 사람이나 관리 권한이 있는 사람만 지울 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.schedules where id = p_schedule_id;
end;
$$;

create or replace function public.update_schedule(
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
  if not private.can_change_schedule(v_row) then
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

-- ---------------------------------------------------------------------
-- 2. 건의 답변·메모 수정·삭제, 건의 삭제
-- ---------------------------------------------------------------------
create or replace function private.can_edit_suggestion_message(p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.suggestion_messages m
    join public.suggestions s on s.id = m.suggestion_id
    where m.id = p_message_id
      and (
        private.is_executive(s.term_id)
        or (private.is_director_or_above(s.term_id) and private.is_suggestion_handler(s.id))
      )
  );
$$;

create function public.delete_suggestion(p_suggestion_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_s public.suggestions%rowtype;
begin
  select * into v_s from public.suggestions where id = p_suggestion_id for update;
  if not found or not private.is_suggestion_handler(p_suggestion_id) then
    raise exception '건의를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  if not (private.is_executive(v_s.term_id) or private.is_director_or_above(v_s.term_id)) then
    raise exception '건의는 회장단이나 맡은 국의 국장만 지울 수 있습니다.' using errcode = '42501';
  end if;
  -- 작성자 연결·답변은 외래 키 cascade로 함께 지워진다. 기록에는 제목·본문을 남기지 않는다.
  delete from public.suggestions where id = p_suggestion_id;
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'DELETE', null, null);
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 회의록 관리·삭제
-- ---------------------------------------------------------------------
create or replace function private.can_manage_meeting(p_meeting public.meeting_minutes)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from private.current_membership(p_meeting.term_id) cm
      where cm.role = 'EXECUTIVE'
         or (cm.role = 'DIRECTOR' and p_meeting.created_by = (select auth.uid()))
    )
    and private.can_view_meeting_values(p_meeting.id, p_meeting.term_id, p_meeting.event_id, p_meeting.created_by)
$$;

create or replace function public.delete_meeting(p_meeting_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_meeting_id);
begin
  if not (
    private.is_executive(v_old.term_id)
    or (private.is_director_or_above(v_old.term_id)
        and (v_old.created_by = (select auth.uid()) or v_old.author_id = (select auth.uid())))
  ) then
    raise exception '회의록은 회장단이나 만든 국장·대표 작성자 국장만 삭제할 수 있습니다.' using errcode = '42501';
  end if;
  delete from public.meeting_minutes where id = p_meeting_id;
  perform private.log_activity(v_old.term_id, 'MEETING', v_old.id, 'DELETE',
    jsonb_build_object('title', v_old.title), null);
end;
$$;

revoke all on function
  private.is_director_or_above(uuid),
  private.can_change_schedule(public.schedules)
from public, anon;
grant execute on function
  private.is_director_or_above(uuid),
  private.can_change_schedule(public.schedules)
to authenticated;

revoke execute on function public.delete_suggestion(uuid) from public, anon;
grant execute on function public.delete_suggestion(uuid) to authenticated;
