import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { OverdueBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, formatDateTime, isOverdue, todayInSeoul } from "@/lib/dates";
import { fetchWeekSchedules } from "@/lib/schedules/queries";
import { addDays, groupByDay, mondayOf, timeLabel, weekDays } from "@/lib/schedules/week";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "대시보드 | 학생회 운영 플랫폼",
};

// 위젯은 기획서 3.1절·부록 C.3 제안값. 모든 위젯은 RLS로 볼 수 있는 자료만 보여 준다.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="대시보드" />
      <Suspense fallback={<div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

const TASK_FIELDS = "id, title, status, due_date, department:departments(name)";

async function DashboardContent() {
  const membership = await requireMember("/dashboard");
  const me = (await getCurrentUserId())!;
  const today = todayInSeoul();
  const supabase = await createClient();

  const [mine, dueSoon, week, events, links] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_FIELDS)
      .eq("term_id", membership.termId)
      .eq("assignee_id", me)
      .neq("status", "DONE")
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("tasks")
      .select(TASK_FIELDS)
      .eq("term_id", membership.termId)
      .neq("status", "DONE")
      .is("archived_at", null)
      .lte("due_date", addDays(today, 3))
      .order("due_date")
      .limit(8),
    fetchWeekSchedules(membership.termId, mondayOf(today)),
    supabase
      .from("events")
      .select("id, name, starts_at")
      .eq("term_id", membership.termId)
      .eq("status", "ACTIVE")
      .order("starts_at", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase.from("dashboard_links").select("id, name, url, description").eq("is_active", true).order("sort_order").order("name"),
  ]);

  // 오늘부터 이번 주 일요일까지만
  const days = weekDays(mondayOf(today)).filter((d) => d >= today);
  const byDay = groupByDay(week.data ?? [], days);
  const upcoming = days.flatMap((d) => byDay.get(d)!.map((s) => ({ day: d, s })));

  return (
    <div className="space-y-6">
      {links.data && links.data.length > 0 && (
        <nav aria-label="바로가기" className="flex flex-wrap gap-2">
          {links.data.map((l) => (
            <a
              key={l.id}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              title={l.description || undefined}
              className={`rounded-full border border-coral-300 bg-coral-50 px-3 py-1 text-sm font-medium text-coral-900 hover:bg-coral-100 dark:border-coral-800 dark:bg-zinc-900 dark:text-coral-300 ${FOCUS_RING}`}
            >
              {l.name} <span className="sr-only">(새 창)</span>↗
            </a>
          ))}
        </nav>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Widget title="내 업무" href="/tasks" failed={!!mine.error} empty={mine.data?.length === 0} emptyText="맡은 업무가 없습니다.">
          {mine.data?.map((t) => (
            <TaskLine key={t.id} task={t} today={today} />
          ))}
        </Widget>

        <Widget title="마감 임박·기한 초과" href="/tasks?tab=all" failed={!!dueSoon.error} empty={dueSoon.data?.length === 0} emptyText="3일 안에 마감인 업무가 없습니다.">
          {dueSoon.data?.map((t) => (
            <TaskLine key={t.id} task={t} today={today} />
          ))}
        </Widget>

        <Widget title="이번 주 일정" href="/schedule" failed={!!week.error} empty={upcoming.length === 0} emptyText="남은 일정이 없습니다.">
          {upcoming.map(({ day, s }) => (
            <li key={`${day}-${s.id}`} className="text-sm">
              <span className="font-semibold text-coral-800 dark:text-coral-300">{formatDate(day, today)}</span>{" "}
              {timeLabel(s)} · {s.title}
            </li>
          ))}
        </Widget>

        <Widget title="진행 중 행사" href="/events" failed={!!events.error} empty={events.data?.length === 0} emptyText="진행 중인 행사가 없습니다.">
          {events.data?.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className={`font-medium underline-offset-2 hover:underline ${FOCUS_RING}`}>
                {e.name}
              </Link>
              {e.starts_at && <span className="text-sm text-zinc-600 dark:text-zinc-400"> · {formatDateTime(e.starts_at, today)}</span>}
            </li>
          ))}
        </Widget>
      </div>
    </div>
  );
}

function Widget({
  title,
  href,
  failed,
  empty,
  emptyText,
  children,
}: {
  title: string;
  href: string;
  failed: boolean;
  empty: boolean | undefined;
  emptyText: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <Link href={href} className={`text-sm text-coral-800 underline dark:text-coral-300 ${FOCUS_RING}`}>
          전체 보기
        </Link>
      </div>
      {failed ? (
        <p className="text-sm text-red-700 dark:text-red-400">불러오지 못했습니다. 새로고침해 주세요.</p>
      ) : empty ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </section>
  );
}

function TaskLine({
  task,
  today,
}: {
  task: { id: string; title: string; status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"; due_date: string | null; department: { name: string } | null };
  today: string;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <Link href={`/tasks/${task.id}`} className={`min-w-0 truncate font-medium underline-offset-2 hover:underline ${FOCUS_RING}`}>
        {task.title}
      </Link>
      <span className="flex items-center gap-1 text-sm text-zinc-600 dark:text-zinc-400">
        {task.due_date && formatDate(task.due_date, today)}
        <TaskStatusBadge status={task.status} />
        {isOverdue(task.due_date, false, today) && <OverdueBadge />}
      </span>
    </li>
  );
}
