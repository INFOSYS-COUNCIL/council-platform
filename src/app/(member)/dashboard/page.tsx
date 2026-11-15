import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { MeetingStatusBadge, OverdueBadge, SuggestionStatusBadge, TaskStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, formatDateTime, isOverdue, todayInSeoul } from "@/lib/dates";
import { fetchWeekSchedules } from "@/lib/schedules/queries";
import { groupByDay, timeLabel, weekDays } from "@/lib/schedules/week";
import { handlerFilter } from "@/lib/suggestions/handler";
import { createClient } from "@/lib/supabase/server";
import { NotificationBell, type NotificationItem } from "./notification-bell";

export const metadata: Metadata = {
  title: "대시보드",
};

// 모든 요약과 위젯은 RLS로 볼 수 있는 자료만 보여 준다.
export default function DashboardPage() {
  return (
    <div className="space-y-6">
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

const TASK_FIELDS = "id, title, status, due_date, department:departments(name), mine:task_assignees()";
const OPEN_SUGGESTION_STATUSES = ["RECEIVED", "IN_REVIEW"] as const;

const NOTIFICATION_TEXT = {
  TASK_CREATED: "새 업무",
  SUGGESTION_SUBMITTED: "새 건의가 접수됐습니다",
  SUGGESTION_ASSIGNED: "건의가 배정됐습니다",
} as const;

// 알림은 회장단·국장에게만 온다(새 업무·새 건의·건의 배정). 제목은 RLS로 볼 수 있을 때만 붙인다.

async function DashboardContent() {
  const membership = await requireMember("/dashboard");
  const me = (await getCurrentUserId())!;
  const today = todayInSeoul();
  const supabase = await createClient();
  // 업무·일정 추가와 건의 처리는 국장·회장단만(DB 함수가 다시 검사한다). 국원에게는 버튼·칸을 보이지 않는다
  const isMember = membership.role === "MEMBER";
  const suggestionScope = handlerFilter(membership, me);

  const [mine, week, links, meetings, suggestions, overdue, notifications, unread] = await Promise.all([
    supabase
      .from("tasks")
      .select(TASK_FIELDS, { count: "exact" })
      .eq("term_id", membership.termId)
      // 내 업무 = 담당자 또는 관리 책임자 (업무 화면과 같은 기준)
      .eq("mine.user_id", me)
      .or(`mine.not.is.null,manager_id.eq.${me}`)
      .neq("status", "DONE")
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
    fetchWeekSchedules(membership.termId, today),
    supabase.from("dashboard_links").select("id, name, url, description").eq("is_active", true).order("sort_order").order("name"),
    supabase
      .from("meeting_minutes")
      .select("id, title, status, updated_at")
      .eq("term_id", membership.termId)
      .eq("kind", "MEETING")
      .neq("status", "ARCHIVED")
      .order("updated_at", { ascending: false })
      .limit(1),
    // 건의 처리 화면과 같은 범위(회장단 전체, 국장 자기 국·자신에게 배정) 중 아직 끝나지 않은 건. 국원은 부르지 않는다
    isMember
      ? null
      : (() => {
        const q = supabase
          .from("suggestions")
          .select("id, title, status, created_at, department:departments(name)", { count: "exact" })
          .eq("term_id", membership.termId)
          .in("status", OPEN_SUGGESTION_STATUSES)
          .order("created_at", { ascending: false })
          .limit(5);
        return suggestionScope ? q.or(suggestionScope) : q;
      })(),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("term_id", membership.termId).is("archived_at", null).neq("status", "DONE").lt("due_date", today),
    isMember ? null : supabase.from("notifications").select("id, kind, created_at, read_at, task:tasks(id, title), suggestion:suggestions(id, title)").order("created_at", { ascending: false }).limit(20),
    isMember ? null : supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  // 오늘을 포함해 앞으로 7일.
  const days = weekDays(today);
  const byDay = groupByDay(week.data ?? [], days);
  const upcomingDays = days.filter((d) => byDay.get(d)!.length > 0);
  const upcomingCount = upcomingDays.reduce((n, d) => n + byDay.get(d)!.length, 0);

  const notificationItems: NotificationItem[] = (notifications?.data ?? []).map((item) => {
    const kind = item.kind as keyof typeof NOTIFICATION_TEXT;
    const target = item.task ? { title: item.task.title, href: `/tasks/${item.task.id}` } : item.suggestion ? { title: item.suggestion.title, href: `/council/suggestions/${item.suggestion.id}` } : null;
    return {
      id: item.id,
      text: target ? `${NOTIFICATION_TEXT[kind] ?? "알림"}: ${target.title}` : NOTIFICATION_TEXT[kind] ?? "알림",
      href: target?.href ?? null,
      when: formatDateTime(item.created_at, today),
      unread: item.read_at === null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm text-muted">{new Date(`${today}T12:00:00+09:00`).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "long" })}</p>
        <PageHeader title="대시보드" actions={!isMember && <NotificationBell items={notificationItems} unreadCount={unread?.count ?? 0} />} />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-2 xl:grid-cols-4" aria-label="업무 요약">
        {[
          { label: "마감 지난 업무 (전체)", count: overdue.error ? null : overdue.count, href: "/tasks", danger: (overdue.count ?? 0) > 0 },
          { label: "내 업무", count: mine.error ? null : mine.count, href: "/tasks?tab=mine", danger: false },
          ...(suggestions ? [{ label: "처리할 건의", count: suggestions.error ? null : suggestions.count, href: "/council/suggestions", danger: false }] : []),
          ...(!isMember ? [{ label: "새 알림", count: unread?.error ? null : unread?.count ?? null, href: "/dashboard", danger: false }] : []),
        ].map((item) => (
          <Link key={item.label} href={item.href} className={`shrink-0 rounded-full border px-3 py-2 text-sm md:rounded-xl md:p-4 ${FOCUS_RING} ${item.danger ? "border-transparent bg-danger-bg text-danger" : "border-zinc-200 bg-surface dark:border-zinc-800"}`}>
            <span className="md:block md:text-muted">{item.label}</span>{" "}<span className="font-semibold tabular-nums md:mt-1 md:block md:text-2xl">{item.count ?? "—"}</span>
          </Link>
        ))}
      </div>
      {(notifications?.error || unread?.error) && <p role="alert" className="text-sm text-danger">알림을 불러오지 못했습니다. 새로고침해 주세요.</p>}
      {links.data && links.data.length > 0 && <nav aria-label="바로가기" className="flex flex-wrap gap-2">{links.data.map((link) => <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className={`rounded-full border border-zinc-200 bg-surface px-3 py-2 text-sm dark:border-zinc-800 ${FOCUS_RING}`}>{link.name} <span aria-hidden="true">↗</span><span className="sr-only">(새 창)</span></a>)}</nav>}
      <div className="grid items-start gap-5 md:grid-cols-2">
        <div className="order-2 space-y-5 md:order-1">
          <Column title="내 업무" count={mine.count} failed={!!mine.error} empty={mine.data?.length === 0} emptyText="맡은 업무가 없습니다." action={<Link href={isMember ? "/tasks" : "/tasks/new"} className={`text-sm font-semibold text-accent ${FOCUS_RING}`}>{isMember ? "전체 보기" : "+ 업무 만들기"}</Link>}>
            {mine.data?.map((task) => <TaskLine key={task.id} task={task} today={today} />)}
          </Column>
          {suggestions && <Column title="처리할 건의" count={suggestions.count} failed={!!suggestions.error} empty={suggestions.data?.length === 0} emptyText="처리할 건의가 없습니다." action={<Link href="/council/suggestions" className={`text-sm text-muted ${FOCUS_RING}`}>전체 보기</Link>}>
            {suggestions.data?.map((suggestion) => <Card key={suggestion.id} href={`/council/suggestions/${suggestion.id}`} title={suggestion.title} meta={<><SuggestionStatusBadge status={suggestion.status} />{formatDateTime(suggestion.created_at, today)} · {suggestion.department?.name ?? "미배정"}</>} />)}
          </Column>}
        </div>
        <div className="order-1 space-y-5 md:order-2">
          <Column title="내 일정" count={upcomingCount} failed={!!week.error} empty={upcomingDays.length === 0} emptyText="앞으로 7일 동안 일정이 없습니다." action={<Link href="/schedule" className={`text-sm text-muted ${FOCUS_RING}`}>달력</Link>}>
            {upcomingDays.flatMap((day) => byDay.get(day)!.map((schedule) => <Card key={`${day}-${schedule.id}`} href={`/schedule?date=${day}`} title={schedule.title} meta={<><span className={day === today ? "font-semibold text-accent" : ""}>{day === today ? "오늘" : formatDate(day, today)}</span>{timeLabel(schedule)}{schedule.location && ` · ${schedule.location}`}</>} />))}
          </Column>

        </div>
      </div>
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-surface px-5 py-4 text-sm dark:border-zinc-800" aria-label="최근 회의록">
        {meetings.error ? <p className="text-danger">최근 회의록을 불러오지 못했습니다.</p> : meetings.data?.[0] ? <Link href={`/meetings/${meetings.data[0].id}`} className={`flex min-w-0 flex-wrap items-center gap-2 ${FOCUS_RING}`}><span className="text-muted">최근 회의록</span><span>{meetings.data[0].title}</span><MeetingStatusBadge status={meetings.data[0].status} /></Link> : <p className="text-muted">볼 수 있는 회의록이 없습니다.</p>}
        <Link href="/meetings" className={`text-muted ${FOCUS_RING}`}>회의록 전체 보기</Link>
      </section>
    </div>
  );
}

function Column({ title, count, failed, empty, emptyText, action, children }: {
  title: string; count?: number | null; failed: boolean; empty: boolean | undefined; emptyText: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-zinc-200 bg-surface dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="font-semibold">{title} {!failed && count != null && <span className="font-normal text-muted">{count}</span>}</h2>
        {action}
      </div>
      {failed ? <p className="px-4 py-5 text-sm text-danger">불러오지 못했습니다. 새로고침해 주세요.</p> : empty ? <p className="px-4 py-5 text-sm text-muted">{emptyText}</p> : <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">{children}</ul>}
    </section>
  );
}

function Card({ href, title, meta }: { href: string; title: string; meta: ReactNode; }) {
  return <li><Link href={href} className={`block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}><span className="block text-sm font-medium">{title}</span>{meta && <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">{meta}</span>}</Link></li>;
}

function TaskLine({
  task,
  today,
}: {
  task: { id: string; title: string; status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE"; due_date: string | null; department: { name: string; } | null; };
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
