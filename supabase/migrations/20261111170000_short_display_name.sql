-- 표시 이름 줄이기(사용 피드백): 학교 Google 계정의 이름은 "이름 | 학과 | 캠퍼스" 꼴이라
-- 화면마다 길게 보인다. 첫 "|" 앞의 이름만 남긴다. 표시용이며 권한 판단에는 쓰지 않는다.

-- 1. 이미 있는 이름
update public.profiles
  set display_name = nullif(trim(split_part(display_name, '|', 1)), '')
  where display_name like '%|%';

-- 2. 새로 가입하는 사람 (20261028080019의 함수에서 이름 부분만 바꾼다)
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google'
     or not private.is_school_email(new.email) then
    raise exception '학교 Google 계정만 가입할 수 있습니다.'
      using errcode = '42501';
  end if;

  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(trim(new.email)),
    -- 표시용 이름일 뿐 권한 판단에는 쓰지 않는다. "이름 | 학과 | 캠퍼스"에서 이름만
    nullif(left(trim(split_part(new.raw_user_meta_data ->> 'full_name', '|', 1)), 50), '')
  );

  return new;
end;
$$;
