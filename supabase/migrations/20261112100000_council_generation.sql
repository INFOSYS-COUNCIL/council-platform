-- 학생회 기수: 대시보드·첫 화면의 "제 <기수>대 정보시스템학과 학생회 '<이름>'" 문구에 쓴다.
-- 비어 있으면 화면은 기수 없이 이름만 보여 준다. 쓰기는 이름과 같은 권한(ACTIVE 기수 회장단).

alter table public.site_settings
  add column council_generation integer,
  add constraint site_settings_council_generation_range check (council_generation between 1 and 999);

create function public.set_council_generation(p_generation integer)
returns public.site_settings
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.site_settings%rowtype;
begin
  if not private.is_executive(private.active_term_id()) then
    raise exception '회장단만 학생회 기수를 바꿀 수 있습니다.' using errcode = '42501';
  end if;
  begin
    update public.site_settings
      set council_generation = p_generation
    where id
    returning * into v_row;
  exception when check_violation then
    raise exception '기수는 1~999 사이의 숫자로 입력해 주세요.' using errcode = '23514';
  end;
  return v_row;
end;
$$;

revoke all on function public.set_council_generation(integer) from public, anon;
grant execute on function public.set_council_generation(integer) to authenticated;
