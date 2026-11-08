import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Section, Skeleton } from "@/components/ui/detail";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, todayInSeoul } from "@/lib/dates";
import { addDays, groupByDay, mondayOf, weekDays } from "@/lib/schedules/week";
import { fetchWeekSchedules } from "@/lib/schedules/queries";
import { NewScheduleForm, ScheduleItem } from "./schedule-parts";

export const metadata: Metadata = {
  title: "일정 | 학생회 운영 플랫폼",
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

// 기본 보기는 이번 주 목록(부록 C.3 제안). 볼 수 있는 일정만 RLS가 돌려준다.
// shortcut: 월 보기 없이 주 단위만. 회장단이 월 보기를 원하면 같은 groupByDay로 6주를 그린다
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
  const raw = (await searchParams).week;
  const today = todayInSeoul();
  const monday = mondayOf(typeof raw === "string" && DATE.test(raw) ? raw : today);
  const sunday = addDays(monday, 6);
  const days = weekDays(monday);

  const { data, error } = await fetchWeekSchedules(membership.termId, monday);

  const byDay = groupByDay(data ?? [], days);
  const canCreate = membership.role !== "MEMBER";
  const isExecutive = membership.role === "EXECUTIVE";
  const weekLink = (date: string, label: string) => (
    <Link href={`/schedule?week=${date}`} className={`rounded-md border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700 ${FOCUS_RING}`}>
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="일정" description={`${formatDate(monday, today)} ~ ${formatDate(sunday, today)}`} />
      <nav aria-label="주 이동" className="flex flex-wrap gap-2">
        {weekLink(addDays(monday, -7), "← 지난주")}
        {weekLink(today, "이번 주")}
        {weekLink(addDays(monday, 7), "다음 주 →")}
      </nav>

      {error ? (
        <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>
      ) : (
        <ol className="space-y-4">
          {days.map((day) => (
            <li key={day}>
              <h2 className={`mb-2 text-sm font-semibold ${day === today ? "text-coral-800 dark:text-coral-300" : ""}`}>
                {formatDate(day, today)}
                {day === today && " · 오늘"}
              </h2>
              {byDay.get(day)!.length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">일정 없음</p>
              ) : (
                <ul className="space-y-2">
                  {byDay.get(day)!.map((s) => (
                    <ScheduleItem key={s.id} s={s} canDelete={isExecutive || s.created_by === me} />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      {canCreate && (
        <Section title="기수 일정 추가">
          <NewScheduleForm defaultDate={today} />
        </Section>
      )}
    </div>
  );
}
