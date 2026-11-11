-- 건의 공개 범위(사용 피드백): 작성자가 "학생회만(COUNCIL, 기본)" 또는 "전체 공개(PUBLIC)"를 고른다.
--   전체 공개: 로그인한 학교 계정이면 누구나 제목·내용·상태·작성자 공개 답변을 본다.
--   작성자 신원(suggestion_authors)과 내부 메모는 공개 여부와 상관없이 지금처럼 숨긴다. 철회된 건의는 공개하지 않는다.

alter table public.suggestions
  add column visibility text not null default 'COUNCIL',
  add constraint suggestions_visibility check (visibility in ('COUNCIL', 'PUBLIC'));

-- 공개 건의인지(정책 안에서 suggestions RLS를 다시 타지 않게 security definer로)
create function private.is_public_suggestion(p_suggestion_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.suggestions s
    where s.id = p_suggestion_id and s.visibility = 'PUBLIC' and s.withdrawn_at is null
  )
$$;
revoke all on function private.is_public_suggestion(uuid) from public, anon;
grant execute on function private.is_public_suggestion(uuid) to authenticated;

create policy "suggestions: public"
  on public.suggestions for select
  to authenticated
  using (visibility = 'PUBLIC' and withdrawn_at is null);

create policy "suggestion messages: public answers"
  on public.suggestion_messages for select
  to authenticated
  using (message_type = 'AUTHOR_VISIBLE' and private.is_public_suggestion(suggestion_id));

-- 제출: 공개 범위를 받는다(매개변수가 늘어 지우고 다시 만든다)
drop function public.submit_suggestion(text, text, uuid);

create function public.submit_suggestion(
  p_title text,
  p_content text,
  p_request_id uuid,
  p_visibility text default 'COUNCIL'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_term uuid;
  v_id uuid;
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception '학교 계정으로 로그인해야 합니다.' using errcode = '42501';
  end if;
  if p_request_id is null then
    raise exception '요청 번호가 없습니다.' using errcode = '22023';
  end if;
  if coalesce(p_visibility, 'COUNCIL') not in ('COUNCIL', 'PUBLIC') then
    raise exception '공개 범위를 다시 골라 주세요.' using errcode = '22023';
  end if;

  -- 같은 요청이 다시 오면 처음 만든 건의를 돌려준다
  select suggestion_id into v_id
  from public.suggestion_authors
  where author_user_id = v_uid and request_id = p_request_id;
  if found then
    return v_id;
  end if;

  select id into v_term from public.terms where status = 'ACTIVE';
  if v_term is null then
    raise exception '지금은 건의를 받지 않는 기간입니다.' using errcode = '55000';  -- D-12
  end if;

  -- shortcut: 빈도 제한은 하루 10건 고정값. 0.2절 운영값이 정해지면 바꾼다
  if (
    select count(*) from public.suggestion_authors a
    join public.suggestions s on s.id = a.suggestion_id
    where a.author_user_id = v_uid and s.created_at > now() - interval '1 day'
  ) >= 10 then
    raise exception '건의는 하루 10건까지 제출할 수 있습니다.' using errcode = '55000';
  end if;

  begin
    insert into public.suggestions (term_id, title, content, visibility)
    values (v_term, trim(p_title), trim(p_content), coalesce(p_visibility, 'COUNCIL'))
    returning id into v_id;
  exception when check_violation then
    raise exception '제목은 1~100자, 내용은 1~3000자로 입력해 주세요.' using errcode = '23514';
  end;
  insert into public.suggestion_authors (suggestion_id, author_user_id, request_id)
  values (v_id, v_uid, p_request_id);

  -- 기록에는 작성자 id와 본문을 남기지 않는다(7.2절). actor_id도 비운다.
  insert into public.activity_logs (term_id, resource_type, resource_id, action)
  values (v_term, 'SUGGESTION', v_id, 'SUBMIT');
  return v_id;
end;
$$;

revoke execute on function public.submit_suggestion(text, text, uuid, text) from public, anon;
grant execute on function public.submit_suggestion(text, text, uuid, text) to authenticated;
