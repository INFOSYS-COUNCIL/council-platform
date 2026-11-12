-- 2차 QA: 조직도를 권한과 상관없이 보여 준다(업무 공간 > 조직도, 첫 화면).
-- 활동 중인 기수의 활성 구성원 이름·역할·국·직책만 돌려준다. 이메일·학번은 넣지 않는다.
-- 첫 화면은 로그인 전에도 보이므로 anon에게도 연다.

create function public.council_org_chart()
returns table (
  name text,
  role public.member_role,
  department_name text,
  department_sort integer,
  position_name text,
  position_sort integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(nullif(trim(p.display_name), ''), '이름 없음'),
    m.role,
    d.name,
    d.sort_order,
    pos.name,
    pos.sort_order
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join public.departments d on d.id = m.department_id and d.is_active
  left join public.positions pos on pos.id = m.position_id and pos.is_active
  where m.term_id = private.active_term_id() and m.is_active
  order by d.sort_order nulls first, m.role desc, pos.sort_order nulls last, 1
$$;

revoke all on function public.council_org_chart() from public;
grant execute on function public.council_org_chart() to anon, authenticated;
