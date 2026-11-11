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
// 배치(1차 사용 피드백): 바로가기 → 보드(마감 임박 → 내 업무 → 이번 주 일정 → 처리할 건의 → 최근 회의록 → 진행 중 행사).
// 칸 제목 옆 숫자가 요약 숫자를 대신한다. 학생회 규모에 맞게 통계·차트는 두지 않는다.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="대시보드" description="마감이 가까운 업무부터 내 업무, 이번 주 일정, 처리할 건의를 한눈에 봅니다." />
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
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
    <div className="space-y-5">
      {links.data && links.data.length > 0 && (
        <nav aria-label="바로가기">
          <ul className="flex flex-wrap gap-2">
            {links.data.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={l.description || undefined}
                  className={`inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1 text-sm font-medium shadow-sm hover:border-coral-300 hover:text-coral-800 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-coral-800 dark:hover:text-coral-300 ${FOCUS_RING}`}
                >
                  {l.name} <span className="sr-only">(새 창)</span>
                  <span aria-hidden="true" className="text-zinc-500">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* 보드: 칸마다 제목·개수, 항목 카드, 아래에 이동 링크. 마감 임박을 맨 앞에 둔다. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Column
          title="마감 임박·기한 초과"
          dot="bg-red-500"
          count={dueSoon.count}
          note={overdueCount > 0 ? `기한 초과 ${overdueCount}건` : undefined}
          failed={!!dueSoon.error}
          empty={dueSoon.data?.length === 0}
          emptyText="3일 안에 마감인 업무가 없습니다."
          footer={{ href: "/tasks?tab=all", label: "전체 업무 보기" }}
        >
          {dueSoon.data?.map((t) => (
            <TaskLine key={t.id} task={t} today={today} />
          ))}
        </Column>

        <Column
          title="내 업무"
          dot="bg-coral-500"
          count={mine.count}
          failed={!!mine.error}
          empty={mine.data?.length === 0}
          emptyText="맡은 업무가 없습니다."
          footer={{ href: "/tasks/new", label: "+ 업무 만들기" }}
        >
          {mine.data?.map((t) => (
            <TaskLine key={t.id} task={t} today={today} />
          ))}
        </Column>

        <Column
          title="이번 주 일정"
          dot="bg-sky-500"
          count={upcomingCount}
          failed={!!week.error}
          empty={upcomingDays.length === 0}
          emptyText="이번 주에 남은 일정이 없습니다."
          footer={{ href: "/schedule", label: "+ 일정 추가" }}
        >
          {upcomingDays.flatMap((day) =>
            byDay.get(day)!.map((s) => (
              <Card
                key={`${day}-${s.id}`}
                href="/schedule"
                title={s.title}
                meta={
                  <>
                    <span className={day === today ? "font-semibold text-coral-800 dark:text-coral-300" : ""}>
                      {day === today ? "오늘" : formatDate(day, today)}
                    </span>
                    <span className="tabular-nums">{timeLabel(s)}</span>
                  </>
                }
              />
            )),
          )}
        </Column>

        <Column
          title="처리할 건의"
          dot="bg-amber-500"
          count={suggestions.count}
          failed={!!suggestions.error}
          empty={suggestions.data?.length === 0}
          emptyText="처리할 건의가 없습니다."
          footer={{ href: "/council/suggestions", label: "받은 건의 전체 보기" }}
        >
          {suggestions.data?.map((s) => (
            <Card
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
        </Column>

        <Column
          title="최근 회의록"
          dot="bg-violet-500"
          failed={!!meetings.error}
          empty={meetings.data?.length === 0}
          emptyText="볼 수 있는 회의록이 없습니다."
          footer={{ href: "/meetings", label: "회의록 전체 보기" }}
        >
          {meetings.data?.map((m) => (
            <Card
              key={m.id}
              href={`/meetings/${m.id}`}
              title={m.title}
              meta={
                <>
                  <span>{formatDateTime(m.updated_at, today)}</span>
                  <Badge tone="neutral">{MEETING_STATUS_LABELS[m.status]}</Badge>
                </>
              }
            />
          ))}
        </Column>

        <Column
          title="진행 중 행사"
          dot="bg-green-500"
          failed={!!events.error}
          empty={events.data?.length === 0}
          emptyText="진행 중인 행사가 없습니다."
          footer={{ href: "/events", label: "행사 전체 보기" }}
        >
          {events.data?.map((e) => (
            <Card
              key={e.id}
              href={`/events/${e.id}`}
              title={e.name}
              meta={e.starts_at ? <span>{formatDateTime(e.starts_at, today)}</span> : null}
            />
          ))}
        </Column>
      </div>
    </div>
  );
}

function Column({
  title,
  dot,
  count,
  note,
  failed,
  empty,
  emptyText,
  footer,
  children,
}: {
  title: string;
  dot: string;
  count?: number | null;
  note?: string;
  failed: boolean;
  empty: boolean | undefined;
  emptyText: string;
  footer: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl bg-zinc-100/80 p-2.5 dark:bg-zinc-900/70">
      <div className="flex items-center gap-2 px-1 pt-0.5">
        <h2 className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-sm font-semibold shadow-sm dark:bg-zinc-800">
          <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
          {title}
        </h2>
        {!failed && count != null && (
          <span className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
            {count}
            <span className="sr-only">건</span>
          </span>
        )}
        {note && <span className="ml-auto text-xs font-medium text-red-700 dark:text-red-400">{note}</span>}
      </div>
      {failed ? (
        <p className="rounded-lg bg-white px-3 py-4 text-sm text-red-700 dark:bg-zinc-900 dark:text-red-400">
          불러오지 못했습니다. 새로고침해 주세요.
        </p>
      ) : empty ? (
        <p className="px-3 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
      <Link
        href={footer.href}
        className={`mt-auto rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-white hover:text-coral-800 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-coral-300 ${FOCUS_RING}`}
      >
        {footer.label}
      </Link>
    </section>
  );
}

function Card({ href, title, meta }: { href: string; title: string; meta: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className={`block rounded-lg border border-zinc-200 bg-white px-3 py-2.5 shadow-sm hover:border-coral-300 dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-coral-800 ${FOCUS_RING}`}
      >
        <span className="block truncate text-sm font-semibold">{title}</span>
        {meta && <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">{meta}</span>}
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
    <Card
      href={`/tasks/${task.id}`}
      title={task.title}
      meta={
        <>
          {task.department && <span>{task.department.name}</span>}
          {task.due_date && <span>{formatDate(task.due_date, today)}</span>}
          <TaskStatusBadge status={task.status} />
          {isOverdue(task.due_date, false, today) && <OverdueBadge />}
        </>
      }
    />
  );
}
