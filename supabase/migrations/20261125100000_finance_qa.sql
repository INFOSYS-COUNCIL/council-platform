alter table public.finance_docs
  add column is_reference boolean not null default false,
  add column event_category text check (event_category in ('라치오스', '미터', '새터')),
  add column first_assignee_id uuid references public.profiles(id) on delete restrict;

-- 기존 업무에서 확인 가능한 최초 배정만 복원한다.
update public.finance_docs d
set is_reference = d.task_id is null and d.form_id is null and d.request_id is null,
    first_assignee_id = (
      select p.id
      from public.tasks t
      left join lateral (
        select l.id, l.before_summary
        from public.activity_logs l
        where l.resource_type = 'TASK' and l.resource_id = t.id and l.action = 'ASSIGNEE_CHANGE'
        order by l.created_at, l.id
        limit 1
      ) first_change on true
      join public.profiles p on p.id::text = case when first_change.id is null then t.assignee_id::text
        else coalesce(first_change.before_summary->>'assignee_id', first_change.before_summary->'assignee_ids'->>0)
      end
      where t.id = d.task_id
    );

create function private.init_finance_doc_qa()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.is_reference := new.task_id is null;
  select assignee_id into new.first_assignee_id from public.tasks where id = new.task_id;
  return new;
end;
$$;

create trigger finance_docs_init_qa before insert on public.finance_docs
for each row execute function private.init_finance_doc_qa();

create function private.remember_finance_assignee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.finance_docs set first_assignee_id = new.assignee_id
  where task_id = new.id and first_assignee_id is null;
  return null;
end;
$$;

create trigger tasks_remember_finance_assignee after update of assignee_id on public.tasks
for each row when (new.assignee_id is not null and new.assignee_id is distinct from old.assignee_id)
execute function private.remember_finance_assignee();

create function public.create_finance_doc_with_event(
  p_form_id uuid, p_title text, p_semester text, p_base_date date,
  p_assignee_id uuid, p_request_id uuid, p_event_category text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_doc uuid;
begin
  v_doc := public.create_finance_doc(p_form_id, p_title, p_semester, p_base_date, p_assignee_id, p_request_id);
  update public.finance_docs set event_category = p_event_category
  where id = v_doc and event_category is null and p_event_category is not null
    and private.finance_role(term_id) is not null;
  return v_doc;
end;
$$;

create function public.save_finance_web_version(
  p_doc_id uuid, p_file_path text, p_file_name text, p_expected_version integer
)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_version integer;
  v_task_id uuid;
begin
  select task_id into v_task_id from public.finance_docs where id = p_doc_id for update;
  if v_task_id is null or not private.can_edit_finance_doc(p_doc_id) then
    raise exception '담당자나 관리 권한자만 초안을 저장할 수 있습니다.' using errcode = '42501';
  end if;
  perform 1 from public.tasks where id = v_task_id for update;
  select coalesce(max(version), 0) into v_version
  from public.finance_doc_versions where doc_id = p_doc_id;
  if v_version is distinct from p_expected_version then
    raise exception '새 버전이 이미 저장되었습니다. 최신 파일을 확인해 주세요.' using errcode = '40001';
  end if;
  return public.add_finance_doc_version(p_doc_id, p_file_path, p_file_name, '웹 편집');
end;
$$;

revoke execute on function public.create_finance_doc_with_event(uuid,text,text,date,uuid,uuid,text),
  public.save_finance_web_version(uuid,text,text,integer) from public, anon;
grant execute on function public.create_finance_doc_with_event(uuid,text,text,date,uuid,uuid,text),
  public.save_finance_web_version(uuid,text,text,integer) to authenticated, service_role;

-- 소속이 없는 사용자의 finance_role은 NULL이므로 명시적으로 거부한다.
create or replace function public.assign_finance_doc(p_doc_id uuid, p_assignee_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_doc public.finance_docs%rowtype;
  v_role text;
begin
  select * into v_doc from public.finance_docs where id = p_doc_id for update;
  v_role := private.finance_role(v_doc.term_id);
  if v_role is distinct from 'DIRECTOR' and v_role is distinct from 'EXECUTIVE' then
    raise exception '재무국장이나 회장단만 담당자를 지정할 수 있습니다.' using errcode = '42501';
  end if;
  if v_doc.task_id is null then raise exception '참고 자료에는 담당자가 없습니다.' using errcode = '55000'; end if;
  if p_assignee_id is not null and not private.is_finance_member_of(v_doc.term_id, p_assignee_id) then
    raise exception '담당자는 이 기수 재무국 구성원이어야 합니다.' using errcode = '22023';
  end if;
  update public.tasks set assignee_id = p_assignee_id where id = v_doc.task_id;
  perform private.log_activity(v_doc.term_id, 'TASK', v_doc.task_id, 'ASSIGNEE_CHANGE', null, jsonb_build_object('assignee', p_assignee_id));
end;
$$;
