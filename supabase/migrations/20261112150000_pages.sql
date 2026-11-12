-- 2차 QA: 기록 > 페이지.
-- 페이지는 회의록과 같은 표(meeting_minutes, kind = 'PAGE')에 둬서 공동 편집·저장·실시간 신호를 그대로 쓴다.
--   만들기: 국원을 포함한 활성 구성원 누구나(create_page). 회의록 편집기의 "/페이지"도 이 함수를 부른다.
--   열람: 전체 공개(ALL_COUNCIL) / 담당국 공개(DEPARTMENT 규칙) / 지정 공개(USER 규칙). 회장단·만든 사람은 항상 본다.
--   본문 편집: 볼 수 있는 사람 누구나(회의록은 지정 편집자만).
--   제목·태그·공개 범위·삭제: 만든 사람 또는 회장단.

alter table public.meeting_minutes
  add column kind text not null default 'MEETING',
  add column tags text[] not null default '{}',
  add constraint meeting_minutes_kind check (kind in ('MEETING', 'PAGE')),
  add constraint meeting_minutes_tags_shape check (cardinality(tags) <= 10);

create index meeting_minutes_term_kind on public.meeting_minutes (term_id, kind, meeting_at desc);

-- 지정 공개: 사람 단위 규칙
alter table public.meeting_access_rules
  add column user_id uuid references public.profiles (id) on delete cascade,
  drop constraint meeting_access_subject_shape,
  drop constraint meeting_access_unique_subject,
  add constraint meeting_access_subject_shape check (
    (subject_type = 'DEPARTMENT' and department_id is not null and role_group is null and user_id is null)
    or (subject_type = 'ROLE_GROUP' and role_group is not null and department_id is null and user_id is null)
    or (subject_type = 'USER' and user_id is not null and department_id is null and role_group is null)
  ),
  add constraint meeting_access_unique_subject unique nulls not distinct
    (meeting_id, subject_type, department_id, role_group, user_id);

-- 열람에 USER 규칙을 더한다. 나머지는 20261109140000_meetings.sql과 같다.
create or replace function private.can_view_meeting_values(
  p_meeting_id uuid,
  p_term_id uuid,
  p_event_id uuid,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.current_membership(p_term_id) cm
    where (
        cm.role = 'EXECUTIVE'
        or p_created_by = (select auth.uid())
        or private.is_meeting_editor(p_meeting_id)
        or exists (
          select 1 from public.meeting_access_rules r
          where r.meeting_id = p_meeting_id
            and (
              (r.subject_type = 'DEPARTMENT' and r.department_id = cm.department_id)
              or (r.subject_type = 'USER' and r.user_id = (select auth.uid()))
              or (r.subject_type = 'ROLE_GROUP' and (
                r.role_group = 'ALL_COUNCIL'
                or (r.role_group = 'DIRECTORS' and cm.role in ('DIRECTOR', 'EXECUTIVE'))
                or (r.role_group = 'EXECUTIVES' and cm.role = 'EXECUTIVE')
              ))
            )
        )
      )
      and (p_event_id is null or private.can_view_event(p_event_id))
  )
$$;

-- 페이지는 볼 수 있는 사람이 모두 본문을 고친다
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
      and (cm.role = 'EXECUTIVE' or m.kind = 'PAGE' or private.is_meeting_editor(m.id))
      and private.can_view_meeting_values(m.id, m.term_id, m.event_id, m.created_by)
  )
$$;

-- 페이지 관리는 만든 사람(직급 무관) 또는 회장단. 회의록 규칙(20261111140000)은 그대로
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
    )
    and private.can_view_meeting_values(p_meeting.id, p_meeting.term_id, p_meeting.event_id, p_meeting.created_by)
$$;

-- 태그: 앞뒤 공백을 지우고, 빈 것·중복을 빼고, 하나에 20자까지
create function private.clean_tags(p_tags text[])
returns text[]
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_agg(distinct t order by t), '{}')
  from (select trim(x) as t from unnest(coalesce(p_tags, '{}')) as x) s
  where t <> '' and length(t) <= 20
$$;

-- 공개 범위 규칙을 다시 쓴다. p_scope: ALL_COUNCIL / DEPARTMENTS / USERS
create function private.write_page_scope(
  p_page public.meeting_minutes,
  p_scope text,
  p_department_ids uuid[],
  p_user_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_scope is null or p_scope not in ('ALL_COUNCIL', 'DEPARTMENTS', 'USERS') then
    raise exception '공개 범위를 하나 선택해 주세요.' using errcode = '22023';
  end if;
  if p_scope = 'DEPARTMENTS' and coalesce(cardinality(p_department_ids), 0) = 0 then
    raise exception '공개할 국을 하나 이상 선택해 주세요.' using errcode = '22023';
  end if;
  if p_scope = 'USERS' and coalesce(cardinality(p_user_ids), 0) = 0 then
    raise exception '공개할 사람을 한 명 이상 선택해 주세요.' using errcode = '22023';
  end if;

  delete from public.meeting_access_rules where meeting_id = p_page.id;

  if p_scope = 'ALL_COUNCIL' then
    insert into public.meeting_access_rules (meeting_id, term_id, subject_type, role_group, granted_by)
    values (p_page.id, p_page.term_id, 'ROLE_GROUP', 'ALL_COUNCIL', (select auth.uid()));
  elsif p_scope = 'DEPARTMENTS' then
    foreach v_id in array p_department_ids loop
      if not exists (
        select 1 from public.departments d where d.id = v_id and d.term_id = p_page.term_id and d.is_active
      ) then
        raise exception '이 기수에서 사용 중인 부서가 아닙니다.' using errcode = '22023';
      end if;
      insert into public.meeting_access_rules (meeting_id, term_id, subject_type, department_id, granted_by)
      values (p_page.id, p_page.term_id, 'DEPARTMENT', v_id, (select auth.uid()))
      on conflict do nothing;
    end loop;
  else
    foreach v_id in array p_user_ids loop
      if not private.is_active_member_of(p_page.term_id, v_id) then
        raise exception '공개할 사람은 이 기수의 활성 구성원이어야 합니다.' using errcode = '22023';
      end if;
      insert into public.meeting_access_rules (meeting_id, term_id, subject_type, user_id, granted_by)
      values (p_page.id, p_page.term_id, 'USER', v_id, (select auth.uid()))
      on conflict do nothing;
    end loop;
  end if;
end;
$$;

create function public.create_page(
  p_term_id uuid,
  p_title text,
  p_state bytea,
  p_state_vector bytea,
  p_tags text[] default '{}',
  p_scope text default 'ALL_COUNCIL',
  p_department_ids uuid[] default '{}',
  p_user_ids uuid[] default '{}'
)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_page public.meeting_minutes%rowtype;
begin
  if not exists (select 1 from private.current_membership(p_term_id)) then
    raise exception '학생회 구성원만 페이지를 만들 수 있습니다.' using errcode = '42501';
  end if;
  if p_state is null or p_state_vector is null then
    raise exception '페이지 초기 상태가 없습니다.' using errcode = '22023';
  end if;
  begin
    insert into public.meeting_minutes (term_id, kind, title, tags, meeting_at, created_by, author_id)
    values (p_term_id, 'PAGE', trim(p_title), private.clean_tags(p_tags), now(),
      (select auth.uid()), (select auth.uid()))
    returning * into v_page;
  exception when check_violation then
    raise exception '제목은 1~100자, 태그는 10개까지 입력해 주세요.' using errcode = '23514';
  end;
  perform private.write_page_scope(v_page, p_scope, p_department_ids, p_user_ids);
  begin
    insert into public.meeting_crdt_snapshots (meeting_id, state_bytes, state_vector, snapshot_version, last_sequence_no)
    values (v_page.id, p_state, p_state_vector, 1, 0);
  exception when check_violation then
    raise exception '페이지 초기 상태가 너무 큽니다.' using errcode = '23514';
  end;
  perform private.log_activity(p_term_id, 'MEETING', v_page.id, 'PAGE_CREATE', null,
    jsonb_build_object('title', v_page.title, 'scope', p_scope));
  return v_page;
end;
$$;

create function public.update_page(
  p_page_id uuid,
  p_title text,
  p_tags text[],
  p_scope text,
  p_department_ids uuid[] default '{}',
  p_user_ids uuid[] default '{}'
)
returns public.meeting_minutes
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_page_id);
  v_new public.meeting_minutes%rowtype;
begin
  if v_old.kind <> 'PAGE' then
    raise exception '페이지가 아닙니다.' using errcode = '22023';
  end if;
  perform private.require_manage_meeting(v_old);
  begin
    update public.meeting_minutes set title = trim(p_title), tags = private.clean_tags(p_tags)
    where id = p_page_id
    returning * into v_new;
  exception when check_violation then
    raise exception '제목은 1~100자, 태그는 10개까지 입력해 주세요.' using errcode = '23514';
  end;
  perform private.write_page_scope(v_new, p_scope, p_department_ids, p_user_ids);
  perform private.log_activity(v_new.term_id, 'MEETING', v_new.id, 'PAGE_UPDATE',
    jsonb_build_object('title', v_old.title), jsonb_build_object('title', v_new.title, 'scope', p_scope));
  return v_new;
end;
$$;

create function public.delete_page(p_page_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.meeting_minutes%rowtype := private.lock_visible_meeting(p_page_id);
begin
  if v_old.kind <> 'PAGE' then
    raise exception '페이지가 아닙니다.' using errcode = '22023';
  end if;
  perform private.require_manage_meeting(v_old);
  delete from public.meeting_minutes where id = p_page_id;
  perform private.log_activity(v_old.term_id, 'MEETING', v_old.id, 'PAGE_DELETE',
    jsonb_build_object('title', v_old.title), null);
end;
$$;

revoke all on function
  private.clean_tags(text[]),
  private.write_page_scope(public.meeting_minutes, text, uuid[], uuid[]),
  public.create_page(uuid, text, bytea, bytea, text[], text, uuid[], uuid[]),
  public.update_page(uuid, text, text[], text, uuid[], uuid[]),
  public.delete_page(uuid)
from public, anon;
grant execute on function
  public.create_page(uuid, text, bytea, bytea, text[], text, uuid[], uuid[]),
  public.update_page(uuid, text, text[], text, uuid[], uuid[]),
  public.delete_page(uuid)
to authenticated;
