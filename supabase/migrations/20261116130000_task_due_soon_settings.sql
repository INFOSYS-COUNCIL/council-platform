alter table public.site_settings add column task_due_soon_days integer not null default 3
  constraint site_settings_task_due_soon_days check (task_due_soon_days between 0 and 365);

create function public.set_task_due_soon_days(p_days integer)
returns public.site_settings language plpgsql volatile security definer set search_path = '' as $$
declare v_settings public.site_settings%rowtype;
begin
  if not private.is_executive(private.active_term_id()) then
    raise exception '회장단만 마감 임박 기준을 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  if p_days is null or p_days < 0 or p_days > 365 then
    raise exception '마감 임박 기준은 0~365일로 입력해 주세요.' using errcode = '22023';
  end if;
  update public.site_settings set task_due_soon_days = p_days where id returning * into v_settings;
  return v_settings;
end;
$$;
revoke all on function public.set_task_due_soon_days(integer) from public, anon;
grant execute on function public.set_task_due_soon_days(integer) to authenticated;
