-- 가이드라인 보호: 국을 지울 때 그 국의 가이드라인이 함께 지워지지 않게 한다.
-- 20261116100000에서 on delete cascade로 연결해, 다른 기록 없이 가이드라인만 있는 국을 지우면 가이드라인이 사라졌다.
-- restrict로 바꿔 다른 기록처럼 "삭제할 수 없습니다. 대신 사용 중지해 주세요"로 막는다.

alter table public.meeting_minutes
  drop constraint meeting_minutes_guide_department,
  add constraint meeting_minutes_guide_department foreign key (term_id, guide_department_id)
    references public.departments (term_id, id) on delete restrict;

-- 안내 문구에 가이드라인을 더한다. 나머지는 20261111180000_delete_org_items.sql과 같다
create or replace function public.delete_department(p_department_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.departments%rowtype;
begin
  select * into v_row from public.departments where id = p_department_id for update;
  if not found then
    raise exception '부서를 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_row.term_id);
  begin
    delete from public.departments where id = p_department_id;
  exception when foreign_key_violation then
    raise exception '이 부서를 쓰는 구성원·업무·행사·건의·가이드라인 기록이 있어 삭제할 수 없습니다. 대신 사용 중지해 주세요.'
      using errcode = '55000';
  end;
end;
$$;
