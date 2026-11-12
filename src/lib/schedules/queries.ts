import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "./week";

// 월요일부터 7일 동안 걸쳐 있는 일정. 볼 수 있는 일정만 RLS가 돌려준다.
export function fetchWeekSchedules(termId: string, monday: string) {
  return fetchSchedules(termId, monday, addDays(monday, 6));
}

// [first, last] 한국 날짜 범위에 걸쳐 있는 일정. 볼 수 있는 일정만 RLS가 돌려준다.
export async function fetchSchedules(termId: string, first: string, last: string) {
  const supabase = await createClient();
  return supabase
    .from("schedules")
    .select("id, title, location, description, color, event_id, created_by, is_all_day, start_date, end_date, starts_at, ends_at, event:events(name)")
    .eq("term_id", termId)
    .or(
      `and(is_all_day.eq.true,start_date.lte.${last},end_date.gte.${first}),` +
        `and(is_all_day.eq.false,starts_at.lt.${addDays(last, 1)}T00:00:00+09:00,ends_at.gte.${first}T00:00:00+09:00)`,
    );
}

// 업무 일정: 시작일~마감일이 [first, last]에 걸친 보관되지 않은 업무. 볼 수 있는 업무만 RLS가 돌려준다.
// 시작일이나 마감일 하나만 있으면 그 하루짜리로 그린다. 달력 그리기 함수가 쓰는 종일 일정 모양으로 바꿔 돌려준다.
export async function fetchTaskSchedules(termId: string, first: string, last: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, start_date, due_date")
    .eq("term_id", termId)
    .is("archived_at", null)
    .or("start_date.not.is.null,due_date.not.is.null")
    .or(`start_date.lte.${last},and(start_date.is.null,due_date.lte.${last})`)
    .or(`due_date.gte.${first},and(due_date.is.null,start_date.gte.${first})`);
  return {
    error,
    data: (data ?? []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      color: TASK_STATUS_COLORS[t.status],
      is_all_day: true,
      start_date: t.start_date ?? t.due_date,
      end_date: t.due_date ?? t.start_date,
      starts_at: null,
      ends_at: null,
    })),
  };
}

// 업무 상태 배지와 같은 계열의 달력 색
const TASK_STATUS_COLORS = { TODO: "violet", IN_PROGRESS: "blue", REVIEW: "orange", DONE: "green" } as const;
