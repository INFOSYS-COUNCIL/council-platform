-- 건의 처리 권한 정리(3차 사용 피드백)
--   1) 일반 국원은 건의를 처리하지 않는다. 처리자는 회장단과 배정된 국의 국장(또는 직접 배정된 국장)뿐이다.
--      국원에게 직접 배정할 수 없고, 이미 국원에게 배정된 건의는 국원에게 더 보이지 않는다(부서 국장·회장단은 그대로 본다).
--   2) 작성자에게 보이는 답변은 회장단이나 국장이 "승인"해야 작성자(전체 공개 건의면 모든 학생)에게 보인다.
--      승인된 답변을 고치면 다시 승인 대기가 된다. 이미 남긴 답변은 승인된 것으로 둔다(지금 작성자가 보고 있으므로).

-- 1. 처리자 판정: 직접 배정도 국장 이상일 때만 인정한다
create or replace function private.is_suggestion_handler_values(
  p_term_id uuid,
  p_assigned_department_id uuid,
  p_assigned_user_id uuid
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
    where cm.role = 'EXECUTIVE'
      or (cm.role = 'DIRECTOR' and (
        cm.department_id = p_assigned_department_id
        or p_assigned_user_id = (select auth.uid())
      ))
  )
$$;

-- 배정: 회장단만, 담당자는 국장이나 회장단만
create or replace function public.assign_suggestion(
  p_suggestion_id uuid,
  p_department_id uuid,
  p_user_id uuid
)
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
  if not found or not private.is_executive(v_s.term_id) then
    raise exception '회장단만 건의를 배정할 수 있습니다.' using errcode = '42501';
  end if;
  if p_user_id is not null and not exists (
    select 1 from public.memberships m
    where m.term_id = v_s.term_id and m.user_id = p_user_id and m.is_active and m.role in ('DIRECTOR', 'EXECUTIVE')
  ) then
    raise exception '건의 담당자는 이 기수의 국장이나 회장단이어야 합니다.' using errcode = '22023';
  end if;
  begin
    update public.suggestions
      set assigned_department_id = p_department_id, assigned_user_id = p_user_id
    where id = p_suggestion_id;
  exception when foreign_key_violation then
    raise exception '이 기수의 부서가 아닙니다.' using errcode = '22023';
  end;
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'ASSIGN',
    jsonb_build_object('department_id', v_s.assigned_department_id, 'user_id', v_s.assigned_user_id),
    jsonb_build_object('department_id', p_department_id, 'user_id', p_user_id));
end;
$$;

-- 2. 답변 승인
alter table public.suggestion_messages
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles (id) on delete set null;

update public.suggestion_messages
  set approved_at = coalesce(updated_at, created_at), approved_by = writer_id
where message_type = 'AUTHOR_VISIBLE';

drop policy "suggestion messages: by type" on public.suggestion_messages;
create policy "suggestion messages: by type"
  on public.suggestion_messages for select
  to authenticated
  using (
    private.is_suggestion_handler(suggestion_id)
    or (message_type = 'AUTHOR_VISIBLE' and approved_at is not null and private.is_suggestion_author(suggestion_id))
  );

drop policy "suggestion messages: public answers" on public.suggestion_messages;
create policy "suggestion messages: public answers"
  on public.suggestion_messages for select
  to authenticated
  using (
    message_type = 'AUTHOR_VISIBLE' and approved_at is not null and private.is_public_suggestion(suggestion_id)
  );

create function public.approve_suggestion_message(p_message_id uuid)
returns public.suggestion_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.suggestion_messages%rowtype;
  v_term uuid;
begin
  select * into v_m from public.suggestion_messages where id = p_message_id for update;
  if not found or not private.is_suggestion_handler(v_m.suggestion_id) then
    raise exception '승인할 수 있는 답변이 아닙니다.' using errcode = '42501';
  end if;
  if v_m.message_type <> 'AUTHOR_VISIBLE' then
    raise exception '내부 메모는 승인하지 않습니다.' using errcode = '22023';
  end if;
  if v_m.approved_at is not null then
    return v_m;
  end if;
  update public.suggestion_messages
    set approved_at = now(), approved_by = (select auth.uid())
  where id = p_message_id
  returning * into v_m;
  select term_id into v_term from public.suggestions where id = v_m.suggestion_id;
  perform private.log_activity(v_term, 'SUGGESTION', v_m.suggestion_id, 'MESSAGE_APPROVE', null, null);
  return v_m;
end;
$$;

revoke execute on function public.approve_suggestion_message(uuid) from public, anon;
grant execute on function public.approve_suggestion_message(uuid) to authenticated;

-- 승인된 답변을 고치면 다시 승인 대기
create or replace function public.update_suggestion_message(p_message_id uuid, p_body text)
returns public.suggestion_messages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_m public.suggestion_messages%rowtype;
  v_term uuid;
begin
  if not private.can_edit_suggestion_message(p_message_id) then
    raise exception '고칠 수 있는 글이 아닙니다.' using errcode = '42501';
  end if;
  begin
    update public.suggestion_messages
    set body = trim(p_body), updated_at = now(), writer_id = (select auth.uid()),
        approved_at = null, approved_by = null
    where id = p_message_id
    returning * into v_m;
  exception when check_violation then
    raise exception '내용은 1~3000자로 입력해 주세요.' using errcode = '23514';
  end;
  select term_id into v_term from public.suggestions where id = v_m.suggestion_id;
  perform private.log_activity(v_term, 'SUGGESTION', v_m.suggestion_id, 'MESSAGE_UPDATE', null,
    jsonb_build_object('message_type', v_m.message_type));
  return v_m;
end;
$$;

-- 답변 완료: 승인된 답변이 하나 이상 있어야 한다
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
    where m.suggestion_id = p_suggestion_id and m.message_type = 'AUTHOR_VISIBLE' and m.approved_at is not null
  ) then
    raise exception '답변 완료로 바꾸기 전에 작성자 답변을 남기고 승인해 주세요.' using errcode = '55000';
  end if;

  update public.suggestions
    set status = p_status,
        resolved_at = case when p_status = 'RESOLVED' then now() end
  where id = p_suggestion_id;
  perform private.log_activity(v_s.term_id, 'SUGGESTION', v_s.id, 'STATUS_CHANGE',
    jsonb_build_object('status', v_s.status), jsonb_build_object('status', p_status));
end;
$$;
