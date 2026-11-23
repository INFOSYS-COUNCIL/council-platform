-- 재무국 업무(재무국 기획서 개정안, 1단계): 양식(.xlsx) 등록·미리보기 → 업무 만들기 → 파일 버전 올리기 → 검토·승인.
--   웹에서 칸을 바로 고치는 편집은 2단계(수식 재계산 검토 후). 1단계는 내려받아 엑셀에서 작성하고 새 버전을 올린다.
--   재무 담당 부서: 부서 이름이 아니라 departments.is_finance 표시로 정한다(기수마다 하나, 회장단이 지정).
--   권한(기획서 4쪽):
--     양식 등록·관리: 재무국장(그 국의 활성 DIRECTOR)과 회장단.
--     업무 만들기: 재무국장·재무국원. 국장은 담당자를 지정할 수 있고, 국원이 만들면 미배정.
--     담당자 지정: 재무국장·회장단. 담당자는 그 기수 재무국 활성 구성원.
--     열람: 회장단 + 재무국 구성원. 민감 양식으로 만든 문서는 회장단·재무국장·만든 사람·담당자만.
--     새 버전 올리기: 담당자·재무국장·회장단(검토 중·완료 문서는 올리지 못함).
--     검토·완료: 연결된 업무의 기존 규칙(change_task_status). 업무 관리 책임자는 재무국장(없으면 만든 회장단).
--   파일: 비공개 저장소 finance-files, 경로 "<term_id>/<파일>". 보기는 그 파일이 등록된 양식·문서를 볼 수 있는 사람만.

alter table public.departments add column is_finance boolean not null default false;
create unique index departments_one_finance_per_term on public.departments (term_id) where is_finance;

create function private.finance_department_id(p_term_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.departments where term_id = p_term_id and is_finance and is_active
$$;

-- 'EXECUTIVE' | 'DIRECTOR'(재무국장) | 'MEMBER'(재무국원) | null
create function private.finance_role(p_term_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when cm.role = 'EXECUTIVE' then 'EXECUTIVE'
    when cm.department_id is not null and cm.department_id = private.finance_department_id(p_term_id) then cm.role::text
  end
  from private.current_membership(p_term_id) cm
$$;

create function private.is_finance_member_of(p_term_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.term_id = p_term_id and m.user_id = p_user_id and m.is_active
      and m.department_id = private.finance_department_id(p_term_id)
  )
$$;

-- 재무 담당 부서 지정(회장단). 같은 기수의 다른 표시는 지운다
create function public.set_finance_department(p_department_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_term uuid;
begin
  select term_id into v_term from public.departments where id = p_department_id and is_active;
  if not found or not private.is_executive(v_term) then
    raise exception '회장단만 재무 담당 부서를 정할 수 있습니다.' using errcode = '42501';
  end if;
  update public.departments set is_finance = false where term_id = v_term and is_finance and id <> p_department_id;
  update public.departments set is_finance = true where id = p_department_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 양식과 양식 버전
-- ---------------------------------------------------------------------
create table public.finance_forms (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  name text not null,
  sensitive boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint finance_forms_name check (length(trim(name)) between 1 and 80)
);

create table public.finance_form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.finance_forms (id) on delete cascade,
  version integer not null,
  file_path text not null,
  file_name text not null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (form_id, version)
);

-- ---------------------------------------------------------------------
-- 재무 문서와 문서 버전. task_id가 없으면 이관본
-- ---------------------------------------------------------------------
create table public.finance_docs (
  id uuid primary key default gen_random_uuid(),
  term_id uuid not null references public.terms (id) on delete restrict,
  form_id uuid references public.finance_forms (id) on delete set null,
  form_version_id uuid references public.finance_form_versions (id) on delete set null,
  task_id uuid unique references public.tasks (id) on delete set null,
  title text not null,
  semester text not null,
  base_date date not null default current_date,
  sensitive boolean not null default false,
  created_by uuid not null references public.profiles (id) on delete restrict,
  request_id uuid,
  created_at timestamptz not null default now(),
  constraint finance_docs_title check (length(trim(title)) between 1 and 120),
  constraint finance_docs_semester check (semester ~ '^[0-9]{4}-[12]$'),
  unique (created_by, request_id)
);
create index finance_docs_term on public.finance_docs (term_id, base_date desc);

create table public.finance_doc_versions (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references public.finance_docs (id) on delete cascade,
  version integer not null,
  file_path text not null,
  file_name text not null,
  note text not null default '',
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint finance_doc_versions_note check (length(note) <= 300),
  unique (doc_id, version)
);

-- 문서를 볼 수 있는가(민감 문서는 회장단·재무국장·만든 사람·담당자만)
create function private.can_view_finance_doc(p_doc_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case private.finance_role(d.term_id)
      when 'EXECUTIVE' then true
      when 'DIRECTOR' then true
      when 'MEMBER' then not d.sensitive
        or d.created_by = (select auth.uid())
        or (d.task_id is not null and private.is_task_assignee(d.task_id, (select auth.uid())))
      else false
    end
    from public.finance_docs d where d.id = p_doc_id
  ), false)
$$;

-- 새 버전을 올릴 수 있는가: 회장단·재무국장, 또는 연결 업무의 담당자
create function private.can_edit_finance_doc(p_doc_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select private.finance_role(d.term_id) in ('EXECUTIVE', 'DIRECTOR')
      or (d.task_id is not null and private.finance_role(d.term_id) = 'MEMBER'
          and private.is_task_assignee(d.task_id, (select auth.uid())))
    from public.finance_docs d where d.id = p_doc_id
  ), false)
$$;

revoke all on function
  private.finance_department_id(uuid), private.finance_role(uuid), private.is_finance_member_of(uuid, uuid),
  private.can_view_finance_doc(uuid), private.can_edit_finance_doc(uuid)
from public;
grant execute on function
  private.finance_department_id(uuid), private.finance_role(uuid), private.is_finance_member_of(uuid, uuid),
  private.can_view_finance_doc(uuid), private.can_edit_finance_doc(uuid)
to authenticated, service_role;

alter table public.finance_forms enable row level security;
alter table public.finance_form_versions enable row level security;
alter table public.finance_docs enable row level security;
alter table public.finance_doc_versions enable row level security;
grant select on public.finance_forms, public.finance_form_versions, public.finance_docs, public.finance_doc_versions to authenticated;

create policy "finance forms: finance members" on public.finance_forms for select to authenticated
  using (private.finance_role(term_id) is not null);
create policy "finance form versions: finance members" on public.finance_form_versions for select to authenticated
  using (exists (select 1 from public.finance_forms f where f.id = form_id and private.finance_role(f.term_id) is not null));
create policy "finance docs: viewers" on public.finance_docs for select to authenticated
  using (private.can_view_finance_doc(id));
create policy "finance doc versions: doc viewers" on public.finance_doc_versions for select to authenticated
  using (private.can_view_finance_doc(doc_id));

-- 파일 경로는 그 기수 폴더 안의 .xlsx만
create function private.require_finance_file(p_term_id uuid, p_path text, p_name text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_path is null or split_part(p_path, '/', 1) <> p_term_id::text or p_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.xlsx$'
     or p_name is null or length(p_name) > 200 or lower(p_name) !~ '\.xlsx$' then
    raise exception '이 기수에 올린 .xlsx 파일만 쓸 수 있습니다.' using errcode = '22023';
  end if;
end;
$$;
revoke all on function private.require_finance_file(uuid, text, text) from public;

-- 양식 등록(새 양식은 v1) 또는 고치기(파일을 주면 새 버전)
create function public.save_finance_form(
  p_id uuid, p_term_id uuid, p_name text, p_sensitive boolean, p_file_path text, p_file_name text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_term uuid := p_term_id;
  v_id uuid := p_id;
  v_next integer;
begin
  if p_id is not null then
    select term_id into v_term from public.finance_forms where id = p_id for update;
    if not found then raise exception '양식을 찾을 수 없습니다.' using errcode = '42501'; end if;
  end if;
  if private.finance_role(v_term) is distinct from 'DIRECTOR' and private.finance_role(v_term) is distinct from 'EXECUTIVE' then
    raise exception '재무국장이나 회장단만 양식을 관리할 수 있습니다.' using errcode = '42501';
  end if;
  begin
    if p_id is null then
      perform private.require_finance_file(v_term, p_file_path, p_file_name);
      insert into public.finance_forms (term_id, name, sensitive, created_by)
      values (v_term, trim(p_name), coalesce(p_sensitive, false), (select auth.uid())) returning id into v_id;
    else
      update public.finance_forms set name = trim(p_name), sensitive = coalesce(p_sensitive, false) where id = p_id;
    end if;
  exception when check_violation then
    raise exception '양식 이름은 1~80자로 입력해 주세요.' using errcode = '23514';
  end;
  if p_file_path is not null then
    perform private.require_finance_file(v_term, p_file_path, p_file_name);
    select coalesce(max(version), 0) + 1 into v_next from public.finance_form_versions where form_id = v_id;
    insert into public.finance_form_versions (form_id, version, file_path, file_name, uploaded_by)
    values (v_id, v_next, p_file_path, p_file_name, (select auth.uid()));
  end if;
  return v_id;
end;
$$;

-- 양식으로 업무 만들기: 업무(재무국, 관리 책임자 재무국장)와 문서를 한 번에 만든다. 같은 요청 번호면 처음 결과를 돌려준다
create function public.create_finance_doc(
  p_form_id uuid, p_title text, p_semester text, p_base_date date, p_assignee_id uuid, p_request_id uuid
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_form public.finance_forms%rowtype;
  v_version public.finance_form_versions%rowtype;
  v_role text;
  v_dept uuid;
  v_manager uuid;
  v_task uuid;
  v_doc uuid;
begin
  if p_request_id is not null then
    select id into v_doc from public.finance_docs where created_by = (select auth.uid()) and request_id = p_request_id;
    if found then return v_doc; end if;
  end if;
  select * into v_form from public.finance_forms where id = p_form_id;
  if not found then raise exception '양식을 찾을 수 없습니다.' using errcode = '42501'; end if;
  v_role := private.finance_role(v_form.term_id);
  if v_role is null then
    raise exception '재무국 구성원만 업무를 만들 수 있습니다.' using errcode = '42501';
  end if;
  -- 국원이 만들면 미배정. 국장·회장단이 고른 담당자는 재무국 활성 구성원이어야 한다
  if v_role = 'MEMBER' then
    p_assignee_id := null;
  elsif p_assignee_id is not null and not private.is_finance_member_of(v_form.term_id, p_assignee_id) then
    raise exception '담당자는 이 기수 재무국 구성원이어야 합니다.' using errcode = '22023';
  end if;
  select * into v_version from public.finance_form_versions where form_id = p_form_id order by version desc limit 1;
  if not found then raise exception '양식 파일이 없습니다.' using errcode = '55000'; end if;

  v_dept := private.finance_department_id(v_form.term_id);
  if v_dept is null then raise exception '재무 담당 부서가 정해지지 않았습니다.' using errcode = '55000'; end if;
  select m.user_id into v_manager from public.memberships m
  where m.term_id = v_form.term_id and m.is_active and m.role = 'DIRECTOR' and m.department_id = v_dept;
  if v_manager is null then
    if v_role = 'EXECUTIVE' then v_manager := (select auth.uid());
    else raise exception '재무국장이 없어 업무를 만들 수 없습니다. 회장단에게 요청해 주세요.' using errcode = '55000';
    end if;
  end if;

  begin
    insert into public.tasks (term_id, department_id, title, description, creator_id, assignee_id, manager_id, visibility_mode)
    values (v_form.term_id, v_dept, trim(p_title), '재무 문서 업무(양식: ' || v_form.name || ')', (select auth.uid()), p_assignee_id, v_manager,
            case when v_form.sensitive then 'RESTRICTED'::public.visibility_mode else 'DEFAULT'::public.visibility_mode end)
    returning id into v_task;
    insert into public.finance_docs (term_id, form_id, form_version_id, task_id, title, semester, base_date, sensitive, created_by, request_id)
    values (v_form.term_id, v_form.id, v_version.id, v_task, trim(p_title), p_semester, coalesce(p_base_date, current_date), v_form.sensitive, (select auth.uid()), p_request_id)
    returning id into v_doc;
  exception when check_violation then
    raise exception '제목(1~120자)과 학기(예: 2026-2)를 확인해 주세요.' using errcode = '23514';
  end;
  perform private.log_activity(v_form.term_id, 'TASK', v_task, 'CREATE', null, jsonb_build_object('finance_doc', v_doc));
  return v_doc;
end;
$$;

-- 담당자 지정: 재무국장·회장단
create function public.assign_finance_doc(p_doc_id uuid, p_assignee_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_doc public.finance_docs%rowtype;
begin
  select * into v_doc from public.finance_docs where id = p_doc_id for update;
  if not found or private.finance_role(v_doc.term_id) not in ('DIRECTOR', 'EXECUTIVE') then
    raise exception '재무국장이나 회장단만 담당자를 지정할 수 있습니다.' using errcode = '42501';
  end if;
  if v_doc.task_id is null then raise exception '이관본에는 담당자가 없습니다.' using errcode = '55000'; end if;
  if p_assignee_id is not null and not private.is_finance_member_of(v_doc.term_id, p_assignee_id) then
    raise exception '담당자는 이 기수 재무국 구성원이어야 합니다.' using errcode = '22023';
  end if;
  update public.tasks set assignee_id = p_assignee_id where id = v_doc.task_id;
  perform private.log_activity(v_doc.term_id, 'TASK', v_doc.task_id, 'ASSIGNEE_CHANGE', null, jsonb_build_object('assignee', p_assignee_id));
end;
$$;

-- 새 버전 올리기: 담당자·재무국장·회장단. 검토 중·완료 문서는 막고, 시작 전이면 진행 중으로
create function public.add_finance_doc_version(p_doc_id uuid, p_file_path text, p_file_name text, p_note text)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_doc public.finance_docs%rowtype;
  v_status public.task_status;
  v_next integer;
begin
  select * into v_doc from public.finance_docs where id = p_doc_id for update;
  if not found or not private.can_edit_finance_doc(p_doc_id) then
    raise exception '담당자나 재무국장만 새 버전을 올릴 수 있습니다.' using errcode = '42501';
  end if;
  if v_doc.task_id is not null then
    select status into v_status from public.tasks where id = v_doc.task_id;
    if v_status in ('REVIEW', 'DONE') then
      raise exception '검토 중이거나 완료된 문서는 고칠 수 없습니다. 다시 하기로 돌려받은 뒤 올려 주세요.' using errcode = '55000';
    end if;
  end if;
  perform private.require_finance_file(v_doc.term_id, p_file_path, p_file_name);
  select coalesce(max(version), 0) + 1 into v_next from public.finance_doc_versions where doc_id = p_doc_id;
  begin
    insert into public.finance_doc_versions (doc_id, version, file_path, file_name, note, uploaded_by)
    values (p_doc_id, v_next, p_file_path, p_file_name, coalesce(trim(p_note), ''), (select auth.uid()));
  exception when check_violation then
    raise exception '메모는 300자까지 쓸 수 있습니다.' using errcode = '23514';
  end;
  if v_status = 'TODO' then
    update public.tasks set status = 'IN_PROGRESS' where id = v_doc.task_id;
  end if;
  return v_next;
end;
$$;

-- 이관본 등록(지난 자료): 업무 없이 문서와 v1. 재무국장·회장단
create function public.import_finance_doc(
  p_term_id uuid, p_title text, p_semester text, p_base_date date, p_sensitive boolean, p_file_path text, p_file_name text
)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  v_doc uuid;
begin
  if private.finance_role(p_term_id) is distinct from 'DIRECTOR' and private.finance_role(p_term_id) is distinct from 'EXECUTIVE' then
    raise exception '재무국장이나 회장단만 이관본을 등록할 수 있습니다.' using errcode = '42501';
  end if;
  perform private.require_finance_file(p_term_id, p_file_path, p_file_name);
  begin
    insert into public.finance_docs (term_id, title, semester, base_date, sensitive, created_by)
    values (p_term_id, trim(p_title), p_semester, coalesce(p_base_date, current_date), coalesce(p_sensitive, false), (select auth.uid()))
    returning id into v_doc;
  exception when check_violation then
    raise exception '제목(1~120자)과 학기(예: 2026-2)를 확인해 주세요.' using errcode = '23514';
  end;
  insert into public.finance_doc_versions (doc_id, version, file_path, file_name, uploaded_by)
  values (v_doc, 1, p_file_path, p_file_name, (select auth.uid()));
  return v_doc;
end;
$$;

revoke execute on function
  public.set_finance_department(uuid),
  public.save_finance_form(uuid, uuid, text, boolean, text, text),
  public.create_finance_doc(uuid, text, text, date, uuid, uuid),
  public.assign_finance_doc(uuid, uuid),
  public.add_finance_doc_version(uuid, text, text, text),
  public.import_finance_doc(uuid, text, text, date, boolean, text, text)
from public, anon;
grant execute on function
  public.set_finance_department(uuid),
  public.save_finance_form(uuid, uuid, text, boolean, text, text),
  public.create_finance_doc(uuid, text, text, date, uuid, uuid),
  public.assign_finance_doc(uuid, uuid),
  public.add_finance_doc_version(uuid, text, text, text),
  public.import_finance_doc(uuid, text, text, date, boolean, text, text)
to authenticated;

-- ---------------------------------------------------------------------
-- 파일 저장소. 올리기는 재무국 구성원·회장단(그 기수 폴더), 받기는 그 파일을 쓰는 양식·문서를 볼 수 있는 사람
-- shortcut: 올렸지만 등록하지 않은 파일은 남는다. 쌓이면 정리 작업을 추가한다
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('finance-files', 'finance-files', false, 20971520, array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);

create function private.can_read_finance_file(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
      select 1 from public.finance_form_versions v join public.finance_forms f on f.id = v.form_id
      where v.file_path = p_name and private.finance_role(f.term_id) is not null
    )
    or exists (
      select 1 from public.finance_doc_versions v where v.file_path = p_name and private.can_view_finance_doc(v.doc_id)
    )
$$;
revoke all on function private.can_read_finance_file(text) from public;
grant execute on function private.can_read_finance_file(text) to authenticated, service_role;

create policy "finance files: viewers read" on storage.objects for select to authenticated
  using (bucket_id = 'finance-files' and (private.can_read_finance_file(name) or owner_id = (select auth.uid())::text));
create policy "finance files: finance members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'finance-files' and private.finance_role(private.term_id_from_path(name)) is not null);
