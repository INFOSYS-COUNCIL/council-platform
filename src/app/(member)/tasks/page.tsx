import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import {
  badgeToneClass,
  InactiveAssigneeBadge,
  OverdueBadge,
  TASK_STATUS_TONES,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING, LinkButton, SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, PillLink } from "@/components/ui/pagination";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { addDays, formatDate, isOverdue, todayInSeoul } from "@/lib/dates";
import { getTermOrgOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import {
  TASK_CREATE_ROLES,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
} from "@/lib/tasks/labels";
import {
  parseTaskListParams,
  TASK_TABS,
  TASKS_PER_PAGE,
  taskListHref,
  type TaskListParams,
} from "@/lib/tasks/list-params";

export const metadata: Metadata = {
  title: "업무",
};

// 마감까지 이 날수 이하로 남은(또는 지난) 미완료 업무를 맨 위에 빨갛게 모은다
const SOON_DAYS = 3;
const TASK_SELECT =
  "id, title, status, priority, due_date, assignee_id, department:departments(name), assignee:profiles!tasks_assignee_id_fkey(display_name, email)";

export default function TasksPage(props: PageProps<"/tasks">) {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <TasksContent searchParams={props.searchParams} />
    </Suspense>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-9 w-32 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      ))}
    </div>
  );
}

async function TasksContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireMember("/tasks");
  const isExecutive = membership.role === "EXECUTIVE";
  const params = parseTaskListParams(await searchParams, isExecutive);
  const me = (await getCurrentUserId())!; // requireMember가 로그인을 확인했다
  const canCreate = TASK_CREATE_ROLES.includes(membership.role);

  // 볼 수 있는 업무만 RLS가 돌려준다. 탭은 그 안에서 다시 나누는 표시용 조건이다.
  const supabase = await createClient();
  const today = todayInSeoul();
  const soon = addDays(today, SOON_DAYS);
  const archived = params.tab === "archived";
  const base = () => {
    let q = supabase.from("tasks").select(TASK_SELECT, { count: "exact" }).eq("term_id", membership.termId);
    q = archived ? q.not("archived_at", "is", null) : q.is("archived_at", null);
    // 내 업무 = 내가 담당자이거나 관리 책임자인 업무
    if (params.tab === "mine") q = q.or(`assignee_id.eq.${me},manager_id.eq.${me}`);
    if (params.status) q = q.eq("status", params.status);
    return q;
  };

  const from = (params.page - 1) * TASKS_PER_PAGE;
  const [{ data: tasks, count, error }, urgentResult, { members }] = await Promise.all([
    (archived ? base() : base().or(`status.eq.DONE,due_date.is.null,due_date.gt.${soon}`))
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + TASKS_PER_PAGE - 1),
    // shortcut: 급한 업무는 쪽 나누기 없이 50건까지. 더 많아지면 따로 쪽을 붙인다
    archived ? null : base().neq("status", "DONE").lte("due_date", soon).order("due_date").limit(50),
    getTermOrgOptions(membership.termId),
  ]);
  const urgent = urgentResult?.data ?? [];

  const activeIds = new Set(members.map((m) => m.userId));
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / TASKS_PER_PAGE));
  const tabs = (Object.keys(TASK_TABS) as (keyof typeof TASK_TABS)[]).filter((t) => isExecutive || t !== "all");

  type Row = NonNullable<typeof tasks>[number];
  const row = (task: Row, isUrgent: boolean) => {
    const assigneeName = task.assignee ? task.assignee.display_name?.trim() || task.assignee.email : "담당자 없음";
    return (
      <li key={task.id}>
        <Link
          href={`/tasks/${task.id}`}
          className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between ${FOCUS_RING} ${
            isUrgent ? "hover:bg-red-100/60 dark:hover:bg-red-900/40" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
          }`}
        >
          <span className="min-w-0">
            <span className={`block truncate font-medium ${isUrgent ? "text-red-800 dark:text-red-200" : ""}`}>
              {task.title}
            </span>
            <span
              className={`block text-sm ${isUrgent ? "text-red-700 dark:text-red-300" : "text-zinc-600 dark:text-zinc-400"}`}
            >
              {task.department?.name ?? "담당국 없음"} · {assigneeName}
              {task.due_date && ` · 마감 ${formatDate(task.due_date, today)}`}
            </span>
          </span>
          <span className="flex flex-wrap gap-1">
            <TaskStatusBadge status={task.status} />
            <TaskPriorityBadge priority={task.priority} />
            {isOverdue(task.due_date, task.status === "DONE", today) && <OverdueBadge />}
            {task.assignee_id && !activeIds.has(task.assignee_id) && <InactiveAssigneeBadge />}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="업무"
        actions={canCreate && <LinkButton href="/tasks/new">업무 만들기</LinkButton>}
      />

      <nav aria-label="업무 분류" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {tabs.map((t) => (
          <PillLink key={t} href={taskListHref(params, { tab: t })} current={params.tab === t}>
            {TASK_TABS[t]}
          </PillLink>
        ))}
      </nav>

      <StatusFilter params={params} />

      {error ? (
        <Alert>
          불러오지 못했습니다.{" "}
          <SecondaryLinkButton href={taskListHref(params, {})} className="ml-2">
            다시 시도
          </SecondaryLinkButton>
        </Alert>
      ) : (
        <>
          {urgent.length > 0 && (
            <section aria-label="마감 임박·기한 초과" className="space-y-2">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
                마감 임박·기한 초과 ({urgent.length})
              </h2>
              <ul className="divide-y divide-red-200 rounded-md border border-red-300 bg-red-50 dark:divide-red-900 dark:border-red-800 dark:bg-red-950/50">
                {urgent.map((task) => row(task, true))}
              </ul>
            </section>
          )}
          {tasks.length > 0 ? (
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {tasks.map((task) => row(task, false))}
            </ul>
          ) : (
            urgent.length === 0 && (
              <EmptyState
                title="아직 업무가 없습니다."
                action={canCreate && !archived ? <LinkButton href="/tasks/new">+ 업무 만들기</LinkButton> : undefined}
              />
            )
          )}
        </>
      )}

      <Pagination page={params.page} totalPages={totalPages} hrefFor={(page) => taskListHref(params, { page })} />
    </div>
  );
}

function StatusFilter({ params }: { params: TaskListParams }) {
  const options = [null, ...TASK_STATUS_ORDER] as const;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="상태로 거르기">
      {options.map((s) => (
        <Link
          key={s ?? "all"}
          href={taskListHref(params, { status: s })}
          aria-current={params.status === s ? "true" : undefined}
          // 상태마다 배지와 같은 색. 고른 것은 굵은 글씨와 테두리 고리로 표시한다
          className={`rounded-md border px-2.5 py-1 ${FOCUS_RING} ${badgeToneClass(s ? TASK_STATUS_TONES[s] : "neutral")} ${
            params.status === s
              ? "font-semibold ring-2 ring-coral-600 ring-offset-1 dark:ring-coral-400 dark:ring-offset-zinc-950"
              : ""
          }`}
        >
          {s ? TASK_STATUS_LABELS[s] : "모든 상태"}
        </Link>
      ))}
    </div>
  );
}
