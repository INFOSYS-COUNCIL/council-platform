-- Disable the web editor write entry point after retiring the browser editor.
revoke execute on function public.save_finance_web_version(uuid, text, text, integer) from authenticated;

create function private.deletable_finance_version(p_path text)
returns uuid language sql stable security definer set search_path = '' as $$
  select v.id
  from public.finance_doc_versions v
  join public.finance_docs d on d.id = v.doc_id
  join public.tasks t on t.id = d.task_id
  where v.file_path = p_path and not d.is_reference
    and private.finance_role(d.term_id) in ('DIRECTOR', 'EXECUTIVE')
    and exists (select 1 from public.finance_doc_versions newer where newer.doc_id = d.id and newer.version > v.version)
    and not exists (select 1 from public.finance_form_versions f where f.file_path = p_path)
    and not exists (select 1 from public.finance_doc_versions shared where shared.file_path = p_path and shared.id <> v.id)
    and not exists (
      select 1 from public.activity_logs l
      where l.resource_type = 'TASK' and l.resource_id = t.id
        and (l.after_summary->>'status') in ('REVIEW', 'DONE')
        and l.created_at >= v.created_at
        and not exists (
          select 1 from public.finance_doc_versions newer
          where newer.doc_id = d.id and newer.version > v.version and newer.created_at <= l.created_at
        )
    )
$$;

revoke all on function private.deletable_finance_version(text) from public;
grant execute on function private.deletable_finance_version(text) to authenticated;

create function public.deletable_finance_versions(p_doc_id uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select v.id from public.finance_doc_versions v
  where v.doc_id = p_doc_id and private.deletable_finance_version(v.file_path) = v.id
$$;
revoke all on function public.deletable_finance_versions(uuid) from public;
grant execute on function public.deletable_finance_versions(uuid) to authenticated;

-- Supabase Storage API removes the object. Remove the matching app record in the metadata transaction.
create policy "finance files: managers delete prior versions" on storage.objects for delete to authenticated
using (bucket_id = 'finance-files' and private.deletable_finance_version(name) is not null);

create function private.delete_finance_version_record()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_version uuid;
begin
  if old.bucket_id <> 'finance-files' then return old; end if;
  if not exists (select 1 from public.finance_doc_versions where file_path = old.name) then
    return old;
  end if;
  -- Serialize against version uploads and task status changes, then recheck on the locked rows.
  perform 1 from public.finance_docs d
  join public.finance_doc_versions v on v.doc_id = d.id
  where v.file_path = old.name for update of d;
  perform 1 from public.tasks t
  join public.finance_docs d on d.task_id = t.id
  join public.finance_doc_versions v on v.doc_id = d.id
  where v.file_path = old.name for update of t;
  v_version := private.deletable_finance_version(old.name);
  if v_version is null then
    raise exception '이 버전은 삭제할 수 없습니다.' using errcode = '42501';
  end if;
  delete from public.finance_doc_versions where id = v_version;
  return old;
end;
$$;
revoke all on function private.delete_finance_version_record() from public;
create trigger finance_file_delete_version before delete on storage.objects
for each row when (old.bucket_id = 'finance-files') execute function private.delete_finance_version_record();
