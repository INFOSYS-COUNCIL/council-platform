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
    .select("id, title, location, event_id, created_by, is_all_day, start_date, end_date, starts_at, ends_at, event:events(name)")
    .eq("term_id", termId)
    .or(
      `and(is_all_day.eq.true,start_date.lte.${last},end_date.gte.${first}),` +
        `and(is_all_day.eq.false,starts_at.lt.${addDays(last, 1)}T00:00:00+09:00,ends_at.gte.${first}T00:00:00+09:00)`,
    );
}
