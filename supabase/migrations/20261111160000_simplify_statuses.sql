-- 상태 단순화(사용 피드백)
--   행사: 진행 전(PLANNING) → 진행 중(ACTIVE) → 보관함(ARCHIVED). "끝난 행사(COMPLETED)"는 없앤다.
--   회의록: 편집 중(DRAFT) → 보관함(ARCHIVED). 화면에서 "최종본(CONFIRMED)"을 없애고, 있던 최종본은 보관함으로 옮긴다.
--           (확정 함수는 본문 잠금·Snapshot 저장과 얽혀 있어 DB에는 남겨 두고 화면에서만 쓰지 않는다)
--   건의: 접수됨(RECEIVED) → 검토 중(IN_REVIEW) → 답변 완료(RESOLVED). "마감됨(CLOSED)"은 철회된 건의에만 쓴다.
-- enum 값은 Postgres에서 지울 수 없으므로 자료를 옮기고, 행사·건의는 함수와 제약으로 막는다.

-- ---------------------------------------------------------------------
-- 1. 행사
-- ---------------------------------------------------------------------
update public.events set status = 'ARCHIVED' where status = 'COMPLETED';
alter table public.events add constraint events_no_completed check (status <> 'COMPLETED');

create or replace function public.change_event_status(p_event_id uuid, p_status public.event_status)
returns public.events
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_old public.events%rowtype := private.lock_visible_event(p_event_id);
  v_new public.events%rowtype;
  v_order public.event_status[] := array['PLANNING', 'ACTIVE', 'ARCHIVED']::public.event_status[];
  v_from integer;
  v_to integer;
begin
  if not private.can_manage_event(v_old) then
    raise exception '이 행사를 관리할 권한이 없습니다.' using errcode = '42501';
  end if;
  v_from := array_position(v_order, v_old.status);
  v_to := array_position(v_order, p_status);
  if v_to is null or abs(v_to - v_from) <> 1 then
    raise exception '행사 상태는 한 단계씩만 바꿀 수 있습니다.' using errcode = '55000';
  end if;
  if v_old.status = 'ARCHIVED' and not private.is_executive(v_old.term_id) then
    raise exception '보관된 행사는 회장단만 되돌릴 수 있습니다.' using errcode = '42501';
  end if;

  update public.events set status = p_status where id = p_event_id returning * into v_new;
  perform private.log_activity(v_new.term_id, 'EVENT', v_new.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_old.status), jsonb_build_object('status', v_new.status));
  return v_new;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. 회의록: 있던 최종본은 보관함으로
-- ---------------------------------------------------------------------
update public.meeting_minutes set status = 'ARCHIVED' where status = 'CONFIRMED';

-- ---------------------------------------------------------------------
-- 3. 건의: 철회되지 않은 마감 건의는 답변 완료로, 직접 마감으로 바꾸는 것은 막는다
-- ---------------------------------------------------------------------
update public.suggestions
  set status = 'RESOLVED', resolved_at = coalesce(resolved_at, now())
  where status = 'CLOSED' and withdrawn_at is null;
alter table public.suggestions add constraint suggestions_closed_only_withdrawn
  check (status <> 'CLOSED' or withdrawn_at is not null);

create or replace function public.change_suggestion_status(p_suggestion_id uuid, p_status public.suggestion_status)
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
  if v_s.withdrawn_at is not null then
    raise exception '철회된 건의입니다.' using errcode = '55000';
  end if;
  if p_status = 'CLOSED' then
    raise exception '건의 상태는 접수됨·검토 중·답변 완료 중에서 골라 주세요.' using errcode = '22023';
  end if;
  if p_status is null or p_status = v_s.status then
    return;
  end if;
  if p_status = 'RESOLVED' and not exists (
    select 1 from public.suggestion_messages m
    where m.suggestion_id = p_suggestion_id and m.message_type = 'AUTHOR_VISIBLE'
  ) then
    raise exception '답변 완료로 바꾸기 전에 작성자에게 보이는 답변을 먼저 남겨 주세요.' using errcode = '55000';
  end if;

  update public.suggestions
    set status = p_status,
        resolved_at = case when p_status = 'RESOLVED' then now() end
  where id = p_suggestion_id;
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_s.status), jsonb_build_object('status', p_status));
end;
$$;
