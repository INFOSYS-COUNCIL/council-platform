-- 국별 업무 자료 및 가이드라인(4차 사용 피드백): 노션의 국별 가이드 페이지를 사이트로 옮긴다.
-- 페이지 기능(meeting_minutes, kind = 'PAGE')을 그대로 쓰고, 어느 국의 가이드인지만 guide_department_id로 표시한다.
--   열람: 학생회 전체(ALL_COUNCIL). 신입 부원이 자기 국 가이드를 찾아 읽는다.
--   만들기·본문 편집·관리: 회장단, 그 국의 국장, 만든 사람. (일반 페이지는 볼 수 있는 사람이 모두 고치지만 가이드는 아니다)

alter table public.meeting_minutes
  add column guide_department_id uuid,
  add constraint meeting_minutes_guide_department foreign key (term_id, guide_department_id)
    references public.departments (term_id, id) on delete cascade,
  add constraint meeting_minutes_guide_is_page check (guide_department_id is null or kind = 'PAGE');

create index meeting_minutes_guides on public.meeting_minutes (guide_department_id) where guide_department_id is not null;

-- 본문 편집: 가이드는 회장단·그 국 국장·만든 사람만. 나머지는 20261112150000_pages.sql과 같다
create or replace function private.can_edit_meeting(p_meeting_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.meeting_minutes m
    join private.current_membership(m.term_id) cm on true
    where m.id = p_meeting_id
      and m.status = 'DRAFT'
      and (
        cm.role = 'EXECUTIVE'
        or private.is_meeting_editor(m.id)
        or (m.kind = 'PAGE' and (
          m.guide_department_id is null
          or m.created_by = (select auth.uid())
          or (cm.role = 'DIRECTOR' and cm.department_id = m.guide_department_id)
        ))
      )
      and private.can_view_meeting_values(m.id, m.term_id, m.event_id, m.created_by)
  )
$$;

-- 관리(제목·태그·공개 범위·삭제): 기존 규칙 + 가이드는 그 국 국장
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
         or (p_meeting.created_by = (select auth.uid()) and (cm.role = 'DIRECTOR' or p_meeting.kind = 'PAGE'))
         or (cm.role = 'DIRECTOR' and p_meeting.guide_department_id is not null
             and cm.department_id = p_meeting.guide_department_id)
    )
    and private.can_view_meeting_values(p_meeting.id, p_meeting.term_id, p_meeting.event_id, p_meeting.created_by)
$$;

create function public.create_guide(
  p_department_id uuid,
  p_title text,
  p_tags text[],
  p_state bytea,
  p_state_vector bytea
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_dept public.departments%rowtype;
  v_page public.meeting_minutes%rowtype;
begin
  select * into v_dept from public.departments where id = p_department_id and is_active;
  if not found then
    raise exception '사용 중인 부서가 아닙니다.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from private.current_membership(v_dept.term_id) cm
    where cm.role = 'EXECUTIVE' or (cm.role = 'DIRECTOR' and cm.department_id = v_dept.id)
  ) then
    raise exception '회장단이나 그 국의 국장만 가이드를 만들 수 있습니다.' using errcode = '42501';
  end if;

  v_page := public.create_page(v_dept.term_id, p_title, p_state, p_state_vector, p_tags, 'ALL_COUNCIL', '{}', '{}');
  update public.meeting_minutes set guide_department_id = v_dept.id where id = v_page.id;
  return v_page.id;
end;
$$;

revoke execute on function public.create_guide(uuid, text, text[], bytea, bytea) from public, anon;
grant execute on function public.create_guide(uuid, text, text[], bytea, bytea) to authenticated;
