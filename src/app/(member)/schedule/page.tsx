import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Section, Skeleton } from "@/components/ui/detail";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, todayInSeoul } from "@/lib/dates";
import { fetchSchedules } from "@/lib/schedules/queries";
import { addMonths, groupByDay, monthGrid } from "@/lib/schedules/week";
import { NewScheduleForm, ScheduleItem } from "./schedule-parts";

export const metadata: Metadata = {
  title: "일정",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;
const WEEKDAY_HEADERS = ["월", "화", "수", "목", "금", "토", "일"];

// 달력(월 보기). 날짜를 누르면 그 날 일정과 추가 폼이 아래에 나온다.
// 주소: /schedule?month=YYYY-MM&date=YYYY-MM-DD. 볼 수 있는 일정만 RLS가 돌려준다.
export default function SchedulePage(props: PageProps<"/schedule">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <ScheduleContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ScheduleContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const membership = await requireMember("/schedule");
  const me = (await getCurrentUserId())!;
  const params = await searchParams;
  const today = todayInSeoul();
  const selected = typeof params.date === "string" && DATE.test(params.date) ? params.date : today;
  const month = typeof params.month === "string" && MONTH.test(params.month) ? params.month : selected.slice(0, 7);
  const days = monthGrid(month);

  const { data, error } = await fetchSchedules(membership.termId, days[0], days[days.length - 1]);

  const byDay = groupByDay(data ?? [], days);
  const selectedItems = byDay.get(selected) ?? [];
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
      <PageHeader title="일정" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight" aria-live="polite">
          {year}년 {monthNo}월
        </h2>
        <nav aria-label="달 이동" className="flex gap-2">
          {navLink(`/schedule?month=${addMonths(month, -1)}`, "←", "지난달")}
          {navLink(`/schedule?date=${today}`, "오늘")}
          {navLink(`/schedule?month=${addMonths(month, 1)}`, "→", "다음 달")}
        </nav>
      </div>

      {error ? (
        <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-surface shadow-sm dark:border-zinc-800">
          <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400" aria-hidden="true">
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w} className="py-2">{w}</div>
            ))}
          </div>
          <ol className="grid grid-cols-7">
            {days.map((day) => {
              const items = byDay.get(day)!;
              const inMonth = day.startsWith(month);
              const isSelected = day === selected;
              const isToday = day === today;
              return (
                <li key={day} className="min-w-0 border-r border-b border-zinc-200 nth-[7n]:border-r-0 nth-[n+36]:border-b-0 dark:border-zinc-800">
                  <Link
                    href={`/schedule?month=${month}&date=${day}`}
                    scroll={false}
                    aria-current={isSelected ? "date" : undefined}
                    aria-label={`${formatDate(day, today)}${isToday ? " 오늘" : ""}, 일정 ${items.length}개`}
                    className={`flex h-16 flex-col gap-0.5 p-1 text-left sm:h-24 sm:p-1.5 ${FOCUS_RING} -outline-offset-2 ${
                      isSelected ? "bg-coral-50 dark:bg-coral-900/30" : "hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    } ${inMonth ? "" : "opacity-45"}`}
                  >
                    <span
                      className={`grid size-6 place-items-center rounded-full text-xs font-medium ${
                        isToday ? "bg-coral-700 text-white dark:bg-coral-400 dark:text-zinc-950" : ""
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    {/* 넓은 화면: 제목 두 개까지, 좁은 화면: 점 */}
                    <span className="hidden min-w-0 space-y-0.5 sm:block">
                      {items.slice(0, 2).map((s) => (
                        <span key={s.id} className="block truncate rounded bg-coral-100 px-1 text-[11px] leading-4 text-coral-900 dark:bg-coral-900/50 dark:text-coral-200">
                          {s.title}
                        </span>
                      ))}
                      {items.length > 2 && <span className="block text-[11px] text-zinc-600 dark:text-zinc-400">+{items.length - 2}</span>}
                    </span>
                    {items.length > 0 && (
                      <span className="flex gap-0.5 px-1 sm:hidden" aria-hidden="true">
                        {items.slice(0, 3).map((s) => (
                          <span key={s.id} className="size-1.5 rounded-full bg-coral-600" />
                        ))}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <Section title={`${formatDate(selected, today)}${selected === today ? " · 오늘" : ""}`}>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">일정 없음</p>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((s) => (
              <ScheduleItem key={s.id} s={s} canDelete={isExecutive || s.created_by === me} />
            ))}
          </ul>
        )}
      </Section>

      {canCreate && (
        <Section title="기수 일정 추가">
          <NewScheduleForm key={selected} defaultDate={selected} />
        </Section>
      )}
    </div>
  );
}
