import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { OverdueBadge, TaskStatusBadge } from "@/components/ui/badge";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireMember } from "@/lib/auth/session";
import { formatDate, isOverdue, todayInSeoul } from "@/lib/dates";
import { getTermOrgOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { buildOrgChart, type OrgGroup, type OrgPerson } from "@/lib/tasks/org-chart";
import type { TaskStatus } from "@/lib/tasks/labels";

export const metadata: Metadata = {
  title: "조직도·업무 현황",
};

const ROUTE = ADMIN_ROUTES.teamTasks;

type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
  assignee_id: string | null;
  department_id: string;
};

// 조직도처럼 회장단 → 국(국장 → 국원)을 보여 주고, 사람마다 끝나지 않은 업무를 펼쳐 볼 수 있게 한다.
// 회장단은 전체, 국장은 자기 국만. 업무는 RLS가 볼 수 있는 것만 돌려준다.
export default function TeamTasksPage() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="조직도·업무 현황" description="누가 어떤 업무를 맡고 있는지 조직도로 봅니다. 이름을 누르면 끝나지 않은 업무가 펼쳐집니다." />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <TeamTasksContent />
      </Suspense>
    </div>
  );
}

async function TeamTasksContent() {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const [org, tasksResult] = await Promise.all([
    getTermOrgOptions(membership.termId),
    supabase
      .from("tasks")
      .select("id, title, status, due_date, assignee_id, department_id")
      .eq("term_id", membership.termId)
      .neq("status", "DONE")
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false }),
  ]);
  if (tasksResult.error) return <Alert>업무를 불러오지 못했습니다. 새로고침해 주세요.</Alert>;

  const today = todayInSeoul();
  const groups = buildOrgChart<Task>(org, tasksResult.data, membership);
  const [executives, departments] =
    groups[0]?.key === "executives" ? [groups[0], groups.slice(1)] : [null, groups];

  return (
    <div className="space-y-6">
      {executives && (
        <section aria-labelledby="org-executives" className="mx-auto max-w-xl">
          <GroupCard group={executives} today={today} headingId="org-executives" />
        </section>
      )}
      {executives && departments.length > 0 && (
        <div aria-hidden="true" className="mx-auto h-6 w-px bg-zinc-300 dark:bg-zinc-700" />
      )}
      {departments.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">볼 수 있는 국이 없습니다.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((g) => (
            <section key={g.key} aria-labelledby={`org-${g.key}`}>
              <GroupCard group={g} today={today} headingId={`org-${g.key}`} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group, today, headingId }: { group: OrgGroup<Task>; today: string; headingId: string }) {
  const total = group.people.reduce((n, p) => n + p.tasks.length, 0) + group.unassigned.length;
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 id={headingId} className="font-bold">
          {group.title}
        </h2>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">진행 중인 업무 {total}건</span>
      </div>
      {group.people.length === 0 ? (
        <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">구성원이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {group.people.map((p) => (
            <PersonRow key={p.userId} person={p} today={today} />
          ))}
        </ul>
      )}
      {group.unassigned.length > 0 && (
        <details className="border-t border-zinc-200 dark:border-zinc-800">
          <summary className={`cursor-pointer px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/60 ${FOCUS_RING}`}>
            담당자 없는 업무 {group.unassigned.length}건
          </summary>
          <TaskList tasks={group.unassigned} today={today} />
        </details>
      )}
    </div>
  );
}

function PersonRow({ person, today }: { person: OrgPerson<Task>; today: string }) {
  const overdue = person.tasks.filter((t) => isOverdue(t.due_date, false, today)).length;
  // 국원은 국장 아래에 들여 써서 조직도처럼 보이게 한다
  const indent = person.role === "MEMBER" ? "pl-8" : "pl-4";
  return (
    <li>
      <details className="group">
        <summary
          className={`flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 pr-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${indent} ${FOCUS_RING}`}
        >
          <span className="flex min-w-0 items-center gap-2">
            {person.role === "MEMBER" && <span aria-hidden="true" className="text-zinc-400">└</span>}
            <span className="truncate font-medium">{person.name}</span>
            <span className="shrink-0 text-xs text-zinc-600 dark:text-zinc-400">{ROLE_LABELS[person.role]}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 text-xs">
            <span className="text-zinc-600 dark:text-zinc-400">업무 {person.tasks.length}</span>
            {overdue > 0 && <span className="font-semibold text-red-700 dark:text-red-400">마감 지남 {overdue}</span>}
            <span aria-hidden="true" className="text-zinc-400 transition-transform group-open:rotate-90">›</span>
          </span>
        </summary>
        {person.tasks.length === 0 ? (
          <p className={`pb-3 text-sm text-zinc-600 dark:text-zinc-400 ${indent}`}>맡은 업무가 없습니다.</p>
        ) : (
          <TaskList tasks={person.tasks} today={today} />
        )}
      </details>
    </li>
  );
}

function TaskList({ tasks, today }: { tasks: Task[]; today: string }) {
  return (
    <ul className="space-y-1 px-4 pb-3">
      {tasks.map((t) => (
        <li key={t.id}>
          <Link
            href={`/tasks/${t.id}`}
            className={`block rounded-md bg-zinc-50 px-3 py-1.5 text-sm hover:bg-coral-50 dark:bg-zinc-800/60 dark:hover:bg-zinc-800 ${FOCUS_RING}`}
          >
            {/* 국 카드는 좁아서 제목을 한 줄 다 쓰고, 마감일·상태는 아랫줄에 둔다 */}
            <span className="block truncate font-medium">{t.title}</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              {t.due_date && <span>{formatDate(t.due_date, today)}</span>}
              <TaskStatusBadge status={t.status} />
              {isOverdue(t.due_date, false, today) && <OverdueBadge />}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
