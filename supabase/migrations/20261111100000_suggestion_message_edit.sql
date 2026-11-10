-- 2차 사용 피드백: 건의 처리에서 남긴 답변·메모를 고치거나 지울 수 있게 한다.
-- 쓴 사람(아직 그 건의 처리자일 때) 또는 그 기수 회장단만. 기록에는 본문을 복사하지 않는다.

alter table public.suggestion_messages add column updated_at timestamptz;

create function private.can_edit_suggestion_message(p_message_id uuid)
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
        or (m.writer_id = (select auth.uid()) and private.is_suggestion_handler(s.id))
      )
  );
$$;

create function public.update_suggestion_message(p_message_id uuid, p_body text)
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
    set body = trim(p_body), updated_at = now()
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

create function public.delete_suggestion_message(p_message_id uuid)
returns void
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
    raise exception '지울 수 있는 글이 아닙니다.' using errcode = '42501';
  end if;
  delete from public.suggestion_messages where id = p_message_id returning * into v_m;
  select term_id into v_term from public.suggestions where id = v_m.suggestion_id;
  perform private.log_activity(v_term, 'SUGGESTION', v_m.suggestion_id, 'MESSAGE_DELETE',
    jsonb_build_object('message_type', v_m.message_type), null);
end;
$$;

revoke execute on function
  private.can_edit_suggestion_message(uuid),
  public.update_suggestion_message(uuid, text),
  public.delete_suggestion_message(uuid)
from public, anon;

grant execute on function
  public.update_suggestion_message(uuid, text),
  public.delete_suggestion_message(uuid)
to authenticated;
