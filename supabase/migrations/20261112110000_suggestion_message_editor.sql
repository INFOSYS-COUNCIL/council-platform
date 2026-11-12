-- 2차 QA: 남이 답변·메모를 고치면 이름과 일시가 고친 사람·고친 때로 바뀐다.
-- 화면은 updated_at이 있으면 그 시각을 보여 준다. 권한 검사는 그대로(private.can_edit_suggestion_message).

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
    set body = trim(p_body), updated_at = now(), writer_id = (select auth.uid())
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
