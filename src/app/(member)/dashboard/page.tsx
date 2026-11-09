import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Badge, OverdueBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, formatDateTime, isOverdue, todayInSeoul } from "@/lib/dates";
import { MEETING_STATUS_LABELS } from "@/lib/meetings/labels";
import { fetchWeekSchedules } from "@/lib/schedules/queries";
import { addDays, groupByDay, mondayOf, timeLabel, weekDays } from "@/lib/schedules/week";
import { SUGGESTION_STATUS_LABELS } from "@/lib/suggestions/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "대시보드",
};

// 위젯은 기획서 3.1절·부록 C.3 제안값. 모든 위젯은 RLS로 볼 수 있는 자료만 보여 준다.
// 배치(Plane 대시보드 참고): 요약 숫자 → 내 업무·이번 주 일정 → 최근 회의록·처리할 건의
// → 마감 임박·진행 중 행사 → 바로가기. 학생회 규모에 맞게 통계·차트는 두지 않는다.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="대시보드" description="내 업무, 이번 주 일정, 최근 회의록, 처리할 건의를 먼저 보여 줍니다." />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <Skeleton className="h-64 lg:col-span-3" />
        <Skeleton className="h-64 lg:col-span-2" />
      </div>
    </div>
  );
}

const TASK_FIELDS = "id, title, status, due_date, department:departments(name)";
const OPEN_SUGGESTION_STATUSES = ["RECEIVED", "IN_REVIEW"] as const;

async function DashboardContent() {
  const membership = await requireMember("/dashboard");
  const me = (await getCurrentUserId())!;
  const today = todayInSeoul();
  const supabase = await createClient();

  const [mine, dueSoon, week, events, links, meetings, suggestions] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_FIELDS, { count: "exact" })
      .eq("term_id", membership.termId)
      .eq("assignee_id", me)
      .neq("status", "DONE")
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("tasks")
      .select(TASK_FIELDS, { count: "exact" })
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
    supabase
      .from("meeting_minutes")
      .select("id, title, status, updated_at")
      .eq("term_id", membership.termId)
      .neq("status", "ARCHIVED")
      .order("updated_at", { ascending: false })
      .limit(5),
    // 건의 처리 화면과 같은 범위(RLS: 회장단 전체, 국장 자기 국, 국원 직접 배정) 중 아직 끝나지 않은 건
    supabase
      .from("suggestions")
      .select("id, title, status, created_at, department:departments(name)", { count: "exact" })
      .eq("term_id", membership.termId)
      .in("status", OPEN_SUGGESTION_STATUSES)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  // 오늘부터 이번 주 일요일까지만
  const days = weekDays(mondayOf(today)).filter((d) => d >= today);
  const byDay = groupByDay(week.data ?? [], days);
  const upcomingDays = days.filter((d) => byDay.get(d)!.length > 0);
  const upcomingCount = upcomingDays.reduce((n, d) => n + byDay.get(d)!.length, 0);
  const overdueCount = dueSoon.data?.filter((t) => isOverdue(t.due_date, false, today)).length ?? 0;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="내 업무" value={mine.error ? null : (mine.count ?? 0)} unit="건" href="/tasks" />
        <Stat
          label="3일 내 마감"
          value={dueSoon.error ? null : (dueSoon.count ?? 0)}
          unit="건"
          href="/tasks?tab=all"
          note={overdueCount > 0 ? `기한 초과 ${overdueCount}건 포함` : undefined}
        />
        <Stat label="이번 주 남은 일정" value={week.error ? null : upcomingCount} unit="개" href="/schedule" />
        <Stat
          label="처리할 건의"
          value={suggestions.error ? null : (suggestions.count ?? 0)}
          unit="건"
          href="/council/suggestions"
        />
      </dl>

      <div className="grid gap-4 lg:grid-cols-5">
        <Widget
          className="lg:col-span-3"
          title="내 업무"
          href="/tasks"
          failed={!!mine.error}
          empty={mine.data?.length === 0}
          emptyText="맡은 업무가 없습니다."
        >
          {mine.data?.map((t) => (
            <TaskLine key={t.id} task={t} today={today} />
          ))}
        </Widget>

        <Widget
          className="lg:col-span-2"
          title="이번 주 일정"
          href="/schedule"
          failed={!!week.error}
          empty={upcomingDays.length === 0}
          emptyText="남은 일정이 없습니다."
        >
          {upcomingDays.map((day) => (
            <li key={day} className="flex gap-3 px-4 py-2.5">
              <span
                className={`w-20 shrink-0 text-xs font-semibold leading-5 ${
                  day === today ? "text-coral-800 dark:text-coral-300" : "text-zinc-600 dark:text-zinc-400"
                }`}
              >
                {day === today ? "오늘" : formatDate(day, today)}
              </span>
              <ul className="min-w-0 flex-1 space-y-1">
                {byDay.get(day)!.map((s) => (
                  <li key={s.id} className="flex min-w-0 gap-2 text-sm">
                    <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">{timeLabel(s)}</span>
                    <span className="min-w-0 truncate">{s.title}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </Widget>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget
          title="최근 회의록"
          href="/meetings"
          failed={!!meetings.error}
          empty={meetings.data?.length === 0}
          emptyText="볼 수 있는 회의록이 없습니다."
        >
          {meetings.data?.map((m) => (
            <Row
              key={m.id}
              href={`/meetings/${m.id}`}
              title={m.title}
              meta={
                <>
                  <span>{formatDateTime(m.updated_at, today)}</span>
                  <Badge tone={m.status === "CONFIRMED" ? "strong" : "neutral"}>{MEETING_STATUS_LABELS[m.status]}</Badge>
                </>
              }
            />
          ))}
        </Widget>

        <Widget
          title="처리할 건의"
          href="/council/suggestions"
          failed={!!suggestions.error}
          empty={suggestions.data?.length === 0}
          emptyText="처리할 건의가 없습니다."
        >
          {suggestions.data?.map((s) => (
            <Row
              key={s.id}
              href={`/council/suggestions/${s.id}`}
              title={s.title}
              meta={
                <>
                  {s.department && <span>{s.department.name}</span>}
                  <Badge tone={s.status === "IN_REVIEW" ? "strong" : "neutral"}>{SUGGESTION_STATUS_LABELS[s.status]}</Badge>
                </>
              }
            />
          ))}
        </Widget>

        <Widget
          title="마감 임박·기한 초과"
          href="/tasks?tab=all"
          failed={!!dueSoon.error}
          empty={dueSoon.data?.length === 0}
          emptyText="3일 내 마감인 업무가 없습니다."
        >
          {dueSoon.data?.map((t) => (
            <TaskLine key={t.id} task={t} today={today} />
          ))}
        </Widget>

        <Widget
          title="진행 중 행사"
          href="/events"
          failed={!!events.error}
          empty={events.data?.length === 0}
          emptyText="진행 중인 행사가 없습니다."
        >
          {events.data?.map((e) => (
            <Row
              key={e.id}
              href={`/events/${e.id}`}
              title={e.name}
              meta={e.starts_at ? <span>{formatDateTime(e.starts_at, today)}</span> : null}
            />
          ))}
        </Widget>
      </div>

      {links.data && links.data.length > 0 && (
        <section aria-labelledby="links-title" className="space-y-2 pt-2">
          <h2 id="links-title" className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            바로가기
          </h2>
          <ul className="flex flex-wrap gap-2">
            {links.data.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l.description || undefined}
                  className={`inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-sm font-medium shadow-sm hover:border-coral-300 hover:text-coral-800 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-coral-800 dark:hover:text-coral-300 ${FOCUS_RING}`}
                >
                  {l.name} <span className="sr-only">(새 창)</span>
                  <span aria-hidden="true" className="text-zinc-500">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  href,
  note,
}: {
  label: string;
  value: number | null;
  unit: string;
  href: string;
  note?: string;
}) {
  return (
    <div className="relative rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <dt>
        {/* 카드 전체를 누를 수 있게 링크를 카드 크기로 늘린다 */}
        <Link
          href={href}
          className={`text-xs font-medium text-zinc-600 after:absolute after:inset-0 after:rounded-lg dark:text-zinc-400 ${FOCUS_RING}`}
        >
          {label}
        </Link>
      </dt>
      <dd className="mt-1">
        {value === null ? (
          <span className="text-sm text-red-700 dark:text-red-400">불러오지 못함</span>
        ) : (
          <span className="text-2xl font-semibold tabular-nums">
            {value}
            <span className="ml-0.5 text-sm font-normal text-zinc-600 dark:text-zinc-400">{unit}</span>
          </span>
        )}
        {note && <span className="block text-xs text-red-700 dark:text-red-400">{note}</span>}
      </dd>
    </div>
  );
}

function Widget({
  title,
  href,
  failed,
  empty,
  emptyText,
  className = "",
  children,
}: {
  title: string;
  href: string;
  failed: boolean;
  empty: boolean | undefined;
  emptyText: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Link
          href={href}
          className={`rounded-sm text-xs font-medium text-zinc-600 hover:text-coral-800 dark:text-zinc-400 dark:hover:text-coral-300 ${FOCUS_RING}`}
        >
          전체 보기 <span aria-hidden="true">→</span>
          <span className="sr-only">: {title}</span>
        </Link>
      </div>
      {failed ? (
        <p className="px-4 py-6 text-sm text-red-700 dark:text-red-400">불러오지 못했습니다. 새로고침해 주세요.</p>
      ) : empty ? (
        <p className="px-4 py-6 text-center text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 py-1 dark:divide-zinc-800">{children}</ul>
      )}
    </section>
  );
}

function Row({ href, title, meta }: { href: string; title: string; meta: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${FOCUS_RING}`}
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">{meta}</span>
      </Link>
    </li>
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
    <Row
      href={`/tasks/${task.id}`}
      title={task.title}
      meta={
        <>
          {task.department && <span className="hidden sm:inline">{task.department.name}</span>}
          {task.due_date && <span>{formatDate(task.due_date, today)}</span>}
          <TaskStatusBadge status={task.status} />
          {isOverdue(task.due_date, false, today) && <OverdueBadge />}
        </>
      }
    />
  );
}
