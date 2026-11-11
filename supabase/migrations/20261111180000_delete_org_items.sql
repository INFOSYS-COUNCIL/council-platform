-- 관리 > 조직 설정: 부서·직책 삭제(사용 피드백). 회장단만.
-- 구성원·승인 명단·업무·행사·건의·회의록 열람 범위 등이 외래 키(on delete restrict)로 가리키고 있으면
-- 지우지 않고, 대신 사용 중지하라고 알린다. 아무도 쓰지 않는(잘못 만든) 항목만 지워진다.

create function public.delete_department(p_department_id uuid)
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
    raise exception '이 부서를 쓰는 구성원·업무·행사·건의 기록이 있어 삭제할 수 없습니다. 대신 사용 중지해 주세요.'
      using errcode = '55000';
  end;
end;
$$;

create function public.delete_position(p_position_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.positions%rowtype;
begin
  select * into v_row from public.positions where id = p_position_id for update;
  if not found then
    raise exception '직책을 찾을 수 없습니다.' using errcode = '42501';
  end if;
  perform private.require_executive(v_row.term_id);
  begin
    delete from public.positions where id = p_position_id;
  exception when foreign_key_violation then
    raise exception '이 직책을 쓰는 구성원·승인 명단이 있어 삭제할 수 없습니다. 대신 사용 중지해 주세요.'
      using errcode = '55000';
  end;
end;
$$;

revoke execute on function public.delete_department(uuid), public.delete_position(uuid) from public, anon;
grant execute on function public.delete_department(uuid), public.delete_position(uuid) to authenticated;
