import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Section, Skeleton } from "@/components/ui/detail";
import { DialogButton } from "@/components/ui/dialog-button";
import { TaskStatusBadge } from "@/components/ui/badge";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PillLink } from "@/components/ui/pagination";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, todayInSeoul } from "@/lib/dates";
import { fetchSchedules, fetchTaskSchedules } from "@/lib/schedules/queries";
import { scheduleColor } from "@/lib/schedules/colors";
import { addDays, addMonths, groupByDay, isCalendarDate, isMultiDay, sundayOf, monthGrid, weekBars, weekDays } from "@/lib/schedules/week";
import { NewScheduleForm, ScheduleItem } from "./schedule-parts";

export const metadata: Metadata = {
  title: "일정",
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];
// 한 주에 보여 줄 여러 날 일정 막대 줄 수. 넘치는 것은 날짜 칸의 +N으로 센다
const MAX_LANES = 3;

// 달력(월 보기). 전체 일정(행사 같은 일정)과 업무 일정(업무 시작일~마감일) 두 가지로 본다.
// 날짜를 누르면 그 날 일정이 아래에 나온다. 새 일정 추가는 버튼을 눌러야 폼이 열린다.
// 주소: /schedule?view=tasks&month=YYYY-MM&date=YYYY-MM-DD. 볼 수 있는 일정·업무만 RLS가 돌려준다.
export default function SchedulePage(props: PageProps<"/schedule">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ScheduleContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ScheduleContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>>; }) {
  const membership = await requireMember("/schedule");
  const me = (await getCurrentUserId())!;
  const params = await searchParams;
  const today = todayInSeoul();
  const selected = isCalendarDate(params.date) ? params.date : today;
  const month = typeof params.month === "string" && MONTH.test(params.month) ? params.month : selected.slice(0, 7);
  const view = params.view === "tasks" ? "tasks" : "all";
  const mode = params.mode === "week" ? "week" : "month"; // 기본은 월 달력(QA 3차)
  const days = mode === "month" ? monthGrid(month) : weekDays(sundayOf(selected));
  const weeks = Array.from({ length: days.length / 7 }, (_, w) => days.slice(w * 7, w * 7 + 7));

  const range = [membership.termId, days[0], days[days.length - 1]] as const;
  const [schedules, tasks] = await Promise.all([
    view === "all" ? fetchSchedules(...range) : null,
    view === "tasks" ? fetchTaskSchedules(...range) : null,
  ]);
  const error = schedules?.error ?? tasks?.error;
  const data = (schedules?.data ?? tasks?.data ?? []) as { id: string; title: string; color?: string | null; is_all_day: boolean; start_date: string | null; end_date: string | null; starts_at: string | null; ends_at: string | null; }[];

  const byDay = groupByDay(data, days);
  const selectedItems = byDay.get(selected) ?? [];
  const selectedSchedules = (schedules?.data ?? []).filter((x) => selectedItems.some((y) => y.id === x.id));
  const selectedTasks = (tasks?.data ?? []).filter((x) => selectedItems.some((y) => y.id === x.id));
  const q = (extra: string) => `/schedule?mode=${mode}&${view === "tasks" ? "view=tasks&" : ""}${extra}`;
  const canCreate = membership.role !== "MEMBER";
  const isExecutive = membership.role === "EXECUTIVE";
  const [year, monthNo] = month.split("-").map(Number);
  const navLink = (href: string, label: string, ariaLabel?: string) => (
    <Link href={href} aria-label={ariaLabel} className={`rounded-md border border-zinc-300 bg-surface px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="일정" actions={canCreate && view === "all" && <DialogButton label="+ 일정"><NewScheduleForm key={selected} defaultDate={selected} /></DialogButton>} />
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800">
        <nav aria-label="일정 보기" className="flex gap-2">
          <PillLink href={`/schedule?mode=week&view=${view}&date=${selected}`} current={mode === "week"}>주간 목록</PillLink>
          <PillLink href={`/schedule?mode=month&view=${view}&month=${month}&date=${selected}`} current={mode === "month"}>월 달력</PillLink>
        </nav>
        <nav aria-label="일정 종류" className="flex gap-2 pb-2">
          <PillLink variant="chip" href={`/schedule?mode=${mode}&month=${month}&date=${selected}`} current={view === "all"}>전체 일정</PillLink>
          <PillLink variant="chip" href={`/schedule?mode=${mode}&view=tasks&month=${month}&date=${selected}`} current={view === "tasks"}>업무 일정</PillLink>
        </nav>
      </div>
      {/* 월 제목 바로 밑에 달력을 붙인다. 불러오지 못해도 달력 틀은 보여 준다. */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight" aria-live="polite">
            {mode === "month" ? `${year}년 ${monthNo}월` : `${formatDate(days[0], today)} – ${formatDate(days[6], today)}`}
          </h2>
          <nav aria-label="기간 이동" className="flex gap-2">
            {navLink(q(mode === "month" ? `month=${addMonths(month, -1)}` : `date=${addDays(selected, -7)}`), "←", mode === "month" ? "지난달" : "지난주")}
            {navLink(q(`date=${today}`), "오늘")}
            {navLink(q(mode === "month" ? `month=${addMonths(month, 1)}` : `date=${addDays(selected, 7)}`), "→", mode === "month" ? "다음 달" : "다음 주")}
          </nav>
        </div>

        {error && <Alert>일정을 불러오지 못했습니다. 새로고침해 주세요.</Alert>}
        {mode === "month" && <div className="overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-sm dark:border-zinc-800">
          <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" aria-hidden="true">
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w} className="py-2">{w}</div>
            ))}
          </div>
          {/* 주마다 한 줄. 여러 날 일정은 이어진 막대(겹치면 아래 줄), 하루 일정은 그 날 칸 안에 */}
          <ol>
            {weeks.map((week) => {
              const { bars, lanes } = weekBars(data, week);
              const shownLanes = Math.min(lanes, MAX_LANES);
              return (
                <li
                  key={week[0]}
                  className="grid grid-cols-7 border-b border-zinc-200 [--head:28px] [--lane:8px] last:border-b-0 sm:[--head:30px] sm:[--lane:20px] dark:border-zinc-800"
                  style={{ gridTemplateRows: `var(--head) repeat(${shownLanes}, var(--lane)) 1fr` }}
                >
                  {week.map((day, i) => {
                    const items = byDay.get(day)!;
                    const singles = items.filter((x) => !isMultiDay(x));
                    // 막대 줄이 넘쳐 숨긴 여러 날 일정도 +N에 센다
                    const hiddenBars = bars.filter((b) => b.lane >= MAX_LANES && b.col <= i && i < b.col + b.span).length;
                    const more = Math.max(0, singles.length - 2) + hiddenBars;
                    const inMonth = day.startsWith(month);
                    const isSelected = day === selected;
                    const isToday = day === today;
                    return (
                      <Link
                        key={day}
                        href={q(`month=${month}&date=${day}`)}
                        scroll={false}
                        aria-current={isSelected ? "date" : undefined}
                        aria-label={`${formatDate(day, today)}${isToday ? " 오늘" : ""}, 일정 ${items.length}개`}
                        style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                        className={`flex min-h-16 min-w-0 flex-col gap-0.5 border-r border-zinc-200 p-1 text-left last:border-r-0 sm:min-h-24 sm:p-1.5 dark:border-zinc-800 ${FOCUS_RING} -outline-offset-2 ${isSelected ? "bg-coral-50 dark:bg-coral-900/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                          } ${inMonth ? "" : "opacity-45"}`}
                      >
                        <span
                          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium ${isToday ? "bg-coral-700 text-white dark:bg-coral-400 dark:text-zinc-950" : ""
                            }`}
                        >
                          {Number(day.slice(8))}
                        </span>
                        {/* 막대가 차지하는 높이만큼 비워 둔다 */}
                        <span aria-hidden="true" className="shrink-0" style={{ height: `calc(var(--lane) * ${shownLanes})` }} />
                        {/* 넓은 화면: 제목 두 개까지, 좁은 화면: 점 */}
                        <span className="hidden min-w-0 space-y-0.5 sm:block">
                          {singles.slice(0, 2).map((x) => (
                            <span key={x.id} className={`block truncate rounded px-1 text-[11px] leading-4 ${scheduleColor(x.color).chip}`}>
                              {x.title}
                            </span>
                          ))}
                          {more > 0 && <span className="block text-[11px] text-zinc-600 dark:text-zinc-400">+{more}</span>}
                        </span>
                        {singles.length > 0 && (
                          <span className="flex gap-0.5 px-1 sm:hidden" aria-hidden="true">
                            {singles.slice(0, 3).map((x) => (
                              <span key={x.id} className={`size-1.5 rounded-full ${scheduleColor(x.color).dot}`} />
                            ))}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                  {/* 막대는 보이기만 한다. 누르면 아래 날짜 칸이 눌린다(pointer-events-none). 읽기는 날짜 칸의 개수와 아래 목록이 맡는다 */}
                  {bars
                    .filter((b) => b.lane < MAX_LANES)
                    .map((b) => (
                      <span
                        key={`${b.item.id}-${week[0]}`}
                        aria-hidden="true"
                        title={b.item.title}
                        style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.lane + 2 }}
                        className={`pointer-events-none z-10 my-px truncate px-1 text-[11px] leading-[18px] font-medium ${scheduleColor(b.item.color).chip} ${b.fromPrev ? "rounded-l-none" : "ml-1 rounded-l"
                          } ${b.toNext ? "rounded-r-none" : "mr-1 rounded-r"}`}
                      >
                        <span className="hidden sm:inline">{b.item.title}</span>
                      </span>
                    ))}
                </li>
              );
            })}
          </ol>
        </div>}
      </div>

      {mode === "week" && !error && <div className="space-y-5">
        {days.map((day) => {
          const ids = new Set((byDay.get(day) ?? []).map((item) => item.id));
          return <Section key={day} title={`${day === today ? "오늘 · " : ""}${formatDate(day, today)}`}>
            {ids.size === 0 ? <p className="rounded-lg border border-dashed border-zinc-200 px-4 py-3 text-sm text-muted dark:border-zinc-800">{day === today ? "오늘은" : "이날은"} 일정이 없어요.</p> : <ul className="space-y-2">
              {(schedules?.data ?? []).filter((item) => ids.has(item.id)).map((schedule) => <ScheduleItem key={schedule.id} s={schedule} canManage={isExecutive || (membership.role === "DIRECTOR" && schedule.created_by === me)} />)}
              {(tasks?.data ?? []).filter((item) => ids.has(item.id)).map((task) => <li key={task.id}><Link href={`/tasks/${task.id}`} className={`flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-surface px-4 py-3 dark:border-zinc-800 ${FOCUS_RING}`}><span className="text-sm text-muted">종일</span><span className="min-w-0 flex-1">{task.title}</span><TaskStatusBadge status={task.status} /></Link></li>)}
            </ul>}
          </Section>;
        })}
      </div>}
      {mode === "month" && <Section title={`${formatDate(selected, today)}${selected === today ? " · 오늘" : ""}`}>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{view === "tasks" ? "업무 없음" : "일정 없음"}</p>
        ) : (
          <ul className="space-y-2">
            {selectedSchedules.map((s) => (
              <ScheduleItem key={s.id} s={s} canManage={isExecutive || (membership.role === "DIRECTOR" && s.created_by === me)} />
            ))}
            {selectedTasks.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/tasks/${t.id}`}
                  className={`flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${FOCUS_RING}`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{t.title}</span>
                    <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                      {t.start_date === t.end_date ? formatDate(t.start_date!, today) : `${formatDate(t.start_date!, today)} ~ ${formatDate(t.end_date!, today)}`}
                    </span>
                  </span>
                  <TaskStatusBadge status={t.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>}
    </div>
  );
}
