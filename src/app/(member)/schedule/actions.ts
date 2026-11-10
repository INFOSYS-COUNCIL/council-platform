"use server";

import { refresh } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { seoulLocalToIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const COLORS = ["coral", "orange", "amber", "green", "teal", "blue", "violet", "pink"];

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// 종일 일정은 날짜로, 시간 일정은 시각으로 저장한다(기획서 5.4절). 종료는 시작보다 앞설 수 없다.
// 추가·수정이 같은 입력칸(ScheduleFields)을 쓰므로 검사도 함께 한다. 실패하면 오류 문구(string)를 돌려준다.
function readFields(formData: FormData) {
  const isAllDay = formData.get("all_day") === "on";
  const starts = text(formData, "starts");
  const ends = text(formData, "ends") || starts;
  const color = text(formData, "color") || "coral";

  if (isAllDay ? !DATE.test(starts) || !DATE.test(ends) : !DATETIME.test(starts) || !DATETIME.test(ends)) {
    return "시작과 종료를 달력에서 골라 주세요.";
  }
  if (ends < starts) return "종료는 시작보다 앞설 수 없습니다.";
  if (!COLORS.includes(color)) return "색을 다시 골라 주세요.";

  return {
    p_title: text(formData, "title"),
    p_is_all_day: isAllDay,
    p_starts_at: (isAllDay ? null : seoulLocalToIso(starts)) as string,
    p_ends_at: (isAllDay ? null : seoulLocalToIso(ends)) as string,
    p_start_date: (isAllDay ? starts : null) as string,
    p_end_date: (isAllDay ? ends : null) as string,
    p_location: text(formData, "location"),
    p_color: color,
  };
}

export async function createSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/schedule");
  const read = readFields(formData);
  if (typeof read === "string") return actionFailure(read);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_schedule", {
    p_term_id: membership.termId,
    p_event_id: text(formData, "event_id") || (null as unknown as string),
    ...read,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("일정을 추가했습니다.");
}

export async function updateSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/schedule");
  const read = readFields(formData);
  if (typeof read === "string") return actionFailure(read);

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_schedule", {
    p_schedule_id: text(formData, "schedule_id"),
    ...read,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("일정을 고쳤습니다.");
}

export async function deleteSchedule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/schedule");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_schedule", { p_schedule_id: text(formData, "schedule_id") });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("일정을 지웠습니다.");
}
