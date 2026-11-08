import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "./week";

// 월요일부터 7일 동안 걸쳐 있는 일정. 볼 수 있는 일정만 RLS가 돌려준다.
export async function fetchWeekSchedules(termId: string, monday: string) {
  const sunday = addDays(monday, 6);
  const supabase = await createClient();
  return supabase
    .from("schedules")
    .select("id, title, location, event_id, created_by, is_all_day, start_date, end_date, starts_at, ends_at, event:events(name)")
    .eq("term_id", termId)
    .or(
      `and(is_all_day.eq.true,start_date.lte.${sunday},end_date.gte.${monday}),` +
        `and(is_all_day.eq.false,starts_at.lt.${addDays(sunday, 1)}T00:00:00+09:00,ends_at.gte.${monday}T00:00:00+09:00)`,
    );
}
