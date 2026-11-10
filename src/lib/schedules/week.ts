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

// 여러 날에 걸친 일정(시작일 ≠ 종료일)을 한 주 안에서 이어진 막대로 놓는다.
// 겹치지 않게 줄(lane)을 나눈다: 먼저 시작하는 것, 같은 날이면 긴 것부터 비어 있는 가장 위 줄에 둔다.
// col은 그 주에서 0(월)~6(일), span은 그 주 안에서 걸친 날 수. 주를 넘어가면 다음 주에 다시 놓인다.
export type WeekBar<T> = { item: T; col: number; span: number; lane: number; fromPrev: boolean; toNext: boolean };

export function isMultiDay(s: ScheduleTime): boolean {
  const [from, to] = scheduleDateRange(s);
  return from !== to;
}

export function weekBars<T extends ScheduleTime>(schedules: T[], week: string[]): { bars: WeekBar<T>[]; lanes: number } {
  const first = week[0];
  const last = week[week.length - 1];
  const spans = schedules
    .filter(isMultiDay)
    .map((item) => {
      const [from, to] = scheduleDateRange(item);
      return { item, from, to };
    })
    .filter(({ from, to }) => from <= last && to >= first)
    .map(({ item, from, to }) => {
      const col = from < first ? 0 : week.indexOf(from);
      const end = to > last ? week.length - 1 : week.indexOf(to);
      return { item, col, span: end - col + 1, fromPrev: from < first, toNext: to > last };
    })
    .sort((a, b) => a.col - b.col || b.span - a.span);

  const taken: boolean[][] = []; // taken[lane][col]
  const bars = spans.map((s) => {
    let lane = 0;
    while (taken[lane]?.slice(s.col, s.col + s.span).some(Boolean)) lane++;
    taken[lane] ??= Array(week.length).fill(false);
    for (let c = s.col; c < s.col + s.span; c++) taken[lane][c] = true;
    return { ...s, lane };
  });
  return { bars, lanes: taken.length };
}
