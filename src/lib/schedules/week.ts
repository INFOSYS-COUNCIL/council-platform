import { isoToSeoulLocal } from "@/lib/dates";

// 일정 화면의 한 주(월~일, 한국 날짜) 계산. 날짜는 "YYYY-MM-DD" 문자열로 다룬다.

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0=일
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export { addDays };

// 달력 한 장: "YYYY-MM"이 들어 있는 6주(42일), 월요일부터
export function monthGrid(month: string): string[] {
  const monday = mondayOf(`${month}-01`);
  return Array.from({ length: 42 }, (_, i) => addDays(monday, i));
}

// "YYYY-MM"에 달 수를 더한다
export function addMonths(month: string, months: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + months, 1));
  return d.toISOString().slice(0, 7);
}

export type ScheduleTime = {
  is_all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  starts_at: string | null;
  ends_at: string | null;
};

// 일정이 걸쳐 있는 한국 날짜 범위 [시작, 끝]
export function scheduleDateRange(s: ScheduleTime): [string, string] {
  if (s.is_all_day) return [s.start_date!, s.end_date!];
  return [isoToSeoulLocal(s.starts_at).slice(0, 10), isoToSeoulLocal(s.ends_at).slice(0, 10)];
}

// 날짜별로 그 날에 걸친 일정을 모은다. 종일 일정을 먼저, 그다음 시작 시각순
export function groupByDay<T extends ScheduleTime>(schedules: T[], days: string[]): Map<string, T[]> {
  const sorted = [...schedules].sort(
    (a, b) => Number(b.is_all_day) - Number(a.is_all_day) || (a.starts_at ?? "").localeCompare(b.starts_at ?? ""),
  );
  return new Map(
    days.map((day) => [
      day,
      sorted.filter((s) => {
        const [from, to] = scheduleDateRange(s);
        return from <= day && day <= to;
      }),
    ]),
  );
}

// "종일" 또는 "18:00–19:30"
export function timeLabel(s: ScheduleTime): string {
  if (s.is_all_day) return "종일";
  return `${isoToSeoulLocal(s.starts_at).slice(11)}–${isoToSeoulLocal(s.ends_at).slice(11)}`;
}
