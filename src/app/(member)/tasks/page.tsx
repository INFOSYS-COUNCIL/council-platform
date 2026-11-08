import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import {
  InactiveAssigneeBadge,
  OverdueBadge,
  TaskPriorityBadge,
  TaskStatusBadge,
} from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, isOverdue, todayInSeoul } from "@/lib/dates";
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
  title: "업무 | 학생회 운영 플랫폼",
};


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
  let query = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, due_date, assignee_id, department:departments(name), assignee:profiles!tasks_assignee_id_fkey(display_name, email)",
      { count: "exact" },
    )
    .eq("term_id", membership.termId);

  if (params.tab === "archived") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);

  if (params.tab === "mine") query = query.or(`assignee_id.eq.${me},manager_id.eq.${me},creator_id.eq.${me}`);
  if (params.tab === "dept" && membership.departmentId) query = query.eq("department_id", membership.departmentId);
  if (params.tab === "shared") {
    // 내 국 업무도, 내가 담당·관리·생성한 업무도 아닌데 보이는 업무 = 열람 대상으로 공유받은 업무
    query = query
      .neq("department_id", membership.departmentId ?? "00000000-0000-0000-0000-000000000000")
      .or(`assignee_id.is.null,assignee_id.neq.${me}`)
      .neq("manager_id", me)
      .neq("creator_id", me);
  }
  if (params.status) query = query.eq("status", params.status);

  const from = (params.page - 1) * TASKS_PER_PAGE;
  const [{ data: tasks, count, error }, { members }] = await Promise.all([
    query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, from + TASKS_PER_PAGE - 1),
    getTermOrgOptions(membership.termId),
  ]);

  const activeIds = new Set(members.map((m) => m.userId));
  const today = todayInSeoul();
  const totalPages = Math.max(1, Math.ceil((count ?? 0) / TASKS_PER_PAGE));
  const tabs = (Object.keys(TASK_TABS) as (keyof typeof TASK_TABS)[]).filter((t) =>
    isExecutive ? t !== "dept" && t !== "shared" : t !== "all",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="업무"
        actions={
          canCreate && (
            <LinkButton href="/tasks/new">업무 만들기</LinkButton>
          )
        }
      />

      <nav aria-label="업무 분류" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {tabs.map((t) => (
          <Link
            key={t}
            href={taskListHref(params, { tab: t })}
            aria-current={params.tab === t ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-sm ${FOCUS_RING} ${
              params.tab === t
                ? "bg-coral-100 font-semibold text-coral-900 dark:bg-coral-900 dark:text-coral-100"
                : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {TASK_TABS[t]}
          </Link>
        ))}
      </nav>

      <StatusFilter params={params} />

      {error ? (
        <Alert>
          불러오지 못했습니다.{" "}
          <Link href={taskListHref(params, {})} className="underline">
            다시 시도
          </Link>
        </Alert>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="아직 업무가 없습니다."
          action={
            canCreate && params.tab !== "archived" ? (
              <Link href="/tasks/new" className={`inline-block underline ${FOCUS_RING}`}>
                업무 만들기
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {tasks.map((task) => {
            const assigneeName = task.assignee
              ? task.assignee.display_name?.trim() || task.assignee.email
              : "담당자 없음";
            return (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className={`flex flex-col gap-2 p-4 hover:bg-zinc-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-zinc-800 ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{task.title}</span>
                    <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                      {task.department?.name} · {assigneeName}
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
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="쪽 이동" className="flex items-center justify-center gap-4 text-sm">
          {params.page > 1 && (
            <Link href={taskListHref(params, { page: params.page - 1 })} className={`underline ${FOCUS_RING}`}>
              이전
            </Link>
          )}
          <span>
            {params.page} / {totalPages}
          </span>
          {params.page < totalPages && (
            <Link href={taskListHref(params, { page: params.page + 1 })} className={`underline ${FOCUS_RING}`}>
              다음
            </Link>
          )}
        </nav>
      )}
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
          className={`rounded-md border px-2.5 py-1 ${FOCUS_RING} ${
            params.status === s
              ? "border-coral-700 text-coral-800 dark:border-coral-400 dark:text-coral-300"
              : "border-zinc-300 dark:border-zinc-700"
          }`}
        >
          {s ? TASK_STATUS_LABELS[s] : "모든 상태"}
        </Link>
      ))}
    </div>
  );
}
