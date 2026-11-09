"use server";

import { refresh } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { seoulLocalToIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// 시각을 둘 다 비우면 종일 일정이다(기획서 5.4절: 종일은 날짜로, 시간 일정은 시각으로 저장)
export async function createSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/schedule");
  const startDate = text(formData, "start_date");
  const endDate = text(formData, "end_date") || startDate;
  const startTime = text(formData, "start_time");
  const endTime = text(formData, "end_time");
  const isAllDay = !startTime && !endTime;

  if (!DATE.test(startDate) || !DATE.test(endDate)) return actionFailure("날짜를 입력해 주세요.");
  if (!isAllDay && (!TIME.test(startTime) || !TIME.test(endTime))) {
    return actionFailure("시간 일정은 시작·종료 시각을 모두 입력해 주세요. 종일이면 둘 다 비웁니다.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_schedule", {
    p_term_id: membership.termId,
    p_event_id: text(formData, "event_id") || (null as unknown as string),
    p_title: text(formData, "title"),
    p_is_all_day: isAllDay,
    p_starts_at: (isAllDay ? null : seoulLocalToIso(`${startDate}T${startTime}`)) as string,
    p_ends_at: (isAllDay ? null : seoulLocalToIso(`${endDate}T${endTime}`)) as string,
    p_start_date: (isAllDay ? startDate : null) as string,
    p_end_date: (isAllDay ? endDate : null) as string,
    p_location: text(formData, "location"),
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("일정을 추가했습니다.");
}

export async function deleteSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/schedule");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_schedule", { p_schedule_id: text(formData, "schedule_id") });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("일정을 지웠습니다.");
}
