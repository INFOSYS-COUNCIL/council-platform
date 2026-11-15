-- 알림(3차 사용 피드백): 새 업무·새 건의가 생기면 회장단·국장에게 알림을 남긴다. 대시보드의 알림 버튼에서 본다.
--   새 업무: 회장단 + (기본 공개 업무면) 그 국의 국장 + 관리 책임자(국장 이상). 만든 사람은 빼고.
--   새 건의: 회장단(작성자 본인은 빼고). 배정되면: 배정된 국의 국장과 직접 배정된 사람.
--   알림에는 본문을 복사하지 않는다. 제목은 화면에서 업무·건의를 다시 읽어(RLS) 보여 준다.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  task_id uuid references public.tasks (id) on delete cascade,
  suggestion_id uuid references public.suggestions (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,

  constraint notifications_kind check (kind in ('TASK_CREATED', 'SUGGESTION_SUBMITTED', 'SUGGESTION_ASSIGNED')),
  constraint notifications_one_target check ((task_id is null) <> (suggestion_id is null))
);

create index notifications_user on public.notifications (user_id, created_at desc);
create index notifications_task on public.notifications (task_id) where task_id is not null;
create index notifications_suggestion on public.notifications (suggestion_id) where suggestion_id is not null;

alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;

create policy "notifications: own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

-- 내 알림을 모두 읽음으로
create function public.mark_notifications_read()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.notifications set read_at = now()
  where user_id = (select auth.uid()) and read_at is null
$$;

revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- 새 업무
create function private.notify_task_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, task_id)
  select distinct m.user_id, 'TASK_CREATED', new.id
  from public.memberships m
  where m.term_id = new.term_id
    and m.is_active
    and m.user_id <> new.creator_id
    and (
      m.role = 'EXECUTIVE'
      or (m.role = 'DIRECTOR' and new.visibility_mode = 'DEFAULT' and m.department_id = new.department_id)
      or (m.role = 'DIRECTOR' and m.user_id = new.manager_id)
    );
  return null;
end;
$$;

create trigger tasks_notify_created
  after insert on public.tasks
  for each row execute function private.notify_task_created();

-- 새 건의
create function private.notify_suggestion_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, suggestion_id)
  select m.user_id, 'SUGGESTION_SUBMITTED', new.id
  from public.memberships m
  where m.term_id = new.term_id
    and m.is_active
    and m.role = 'EXECUTIVE'
    and m.user_id is distinct from (select auth.uid());
  return null;
end;
$$;

create trigger suggestions_notify_submitted
  after insert on public.suggestions
  for each row execute function private.notify_suggestion_submitted();

-- 건의 배정
create function private.notify_suggestion_assigned()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, suggestion_id)
  select distinct m.user_id, 'SUGGESTION_ASSIGNED', new.id
  from public.memberships m
  where m.term_id = new.term_id
    and m.is_active
    and m.user_id is distinct from (select auth.uid())
    and (
      (m.role = 'DIRECTOR' and new.assigned_department_id is not null
        and new.assigned_department_id is distinct from old.assigned_department_id
        and m.department_id = new.assigned_department_id)
      or (m.role in ('DIRECTOR', 'EXECUTIVE') and new.assigned_user_id is not null
        and new.assigned_user_id is distinct from old.assigned_user_id
        and m.user_id = new.assigned_user_id)
    );
  return null;
end;
$$;

create trigger suggestions_notify_assigned
  after update of assigned_department_id, assigned_user_id on public.suggestions
  for each row execute function private.notify_suggestion_assigned();
