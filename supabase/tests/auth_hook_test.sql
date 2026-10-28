-- 학교 계정 차단(Auth Hook)·가입 트리거·첫 회장단 등록 테스트
-- 실행: npx supabase test db
begin;
select plan(12);

-- Hook 입력을 만드는 도우미. 기본값은 "통과해야 하는 학교 Google 계정"이다.
create function pg_temp.signup_event(
  p_email text default 'test.user@hanyang.ac.kr',
  p_provider text default 'google',
  p_verified boolean default true,
  p_hd text default 'hanyang.ac.kr'
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'metadata', jsonb_build_object('name', 'before-user-created'),
    'user', jsonb_build_object(
      'email', p_email,
      'app_metadata', jsonb_build_object('provider', p_provider),
      'user_metadata', jsonb_strip_nulls(jsonb_build_object(
        'email_verified', p_verified,
        'custom_claims', case when p_hd is null then null else jsonb_build_object('hd', p_hd) end
      ))
    )
  )
$$;

-- ---------------------------------------------------------------------
-- Hook 허용·거부
-- ---------------------------------------------------------------------
select is(
  public.hook_before_user_created(pg_temp.signup_event()),
  '{}'::jsonb,
  '학교 Google Workspace 계정은 가입이 허용된다'
);

select is(
  public.hook_before_user_created(pg_temp.signup_event(p_email => 'Test.User@HANYANG.AC.KR')),
  '{}'::jsonb,
  '대문자가 섞인 학교 이메일도 정규화해서 허용된다'
);

select ok(
  public.hook_before_user_created(pg_temp.signup_event(p_email => 'someone@gmail.com', p_hd => null)) ? 'error',
  '외부 Gmail 계정은 가입이 거부된다'
);

select ok(
  public.hook_before_user_created(pg_temp.signup_event(p_provider => 'github')) ? 'error',
  'Google이 아닌 Provider는 가입이 거부된다'
);

select ok(
  public.hook_before_user_created(pg_temp.signup_event(p_verified => false)) ? 'error',
  '이메일 인증이 안 된 계정은 가입이 거부된다'
);

select ok(
  public.hook_before_user_created(pg_temp.signup_event(p_hd => null)) ? 'error',
  'hd 클레임이 없는 계정은 가입이 거부된다'
);

select ok(
  public.hook_before_user_created(pg_temp.signup_event(p_email => 'x@mail.hanyang.ac.kr', p_hd => 'mail.hanyang.ac.kr')) ? 'error',
  '학교 하위 도메인 이메일은 가입이 거부된다'
);

select ok(
  public.hook_before_user_created(pg_temp.signup_event(p_email => 'x@hanyang.ac.kr.evil.com')) ? 'error',
  '학교 도메인을 앞에 붙인 가짜 도메인은 가입이 거부된다'
);

-- ---------------------------------------------------------------------
-- 가입 트리거: Hook을 우회해도 학교 계정이 아니면 auth.users가 생기지 않는다
-- ---------------------------------------------------------------------
select throws_ok(
  $$ insert into auth.users (id, aud, role, email, email_confirmed_at, raw_app_meta_data)
     values (gen_random_uuid(), 'authenticated', 'authenticated', 'outsider@gmail.com', now(), '{"provider":"google"}') $$,
  '42501',
  null,
  'Hook을 우회해도 학교 외 계정은 가입 트리거에서 거부된다'
);

-- ---------------------------------------------------------------------
-- 클라이언트는 Hook 함수를 직접 호출할 수 없다
-- ---------------------------------------------------------------------
set local role authenticated;
select throws_ok(
  $$ select public.hook_before_user_created('{}'::jsonb) $$,
  '42501',
  null,
  '로그인 사용자는 Hook 함수를 직접 호출할 수 없다'
);
reset role;

-- ---------------------------------------------------------------------
-- 첫 회장단 등록 (비상 절차)
-- ---------------------------------------------------------------------
select lives_ok(
  $$ select private.bootstrap_first_executive(
       '00000000-0000-0000-0000-000000000001', 'test.first.exec@hanyang.ac.kr') $$,
  '회장단이 없는 기수에는 첫 회장단을 한 번 등록할 수 있다'
);

select throws_ok(
  $$ select private.bootstrap_first_executive(
       '00000000-0000-0000-0000-000000000001', 'test.second.exec@hanyang.ac.kr') $$,
  'P0001',
  null,
  '이미 회장단이 있는 기수에는 비상 절차를 다시 쓸 수 없다'
);

select * from finish();
rollback;
