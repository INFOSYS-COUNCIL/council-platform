"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  actionFailure,
  actionSuccess,
  rpcErrorMessage,
  type ActionState,
  type FieldErrors,
} from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { seoulLocalToIso } from "@/lib/dates";
import {
  EVENT_CREATE_ROLES,
  EVENT_STATUS_ORDER,
  type EventStatus,
  type EventVisibility,
} from "@/lib/events/labels";
import { parseAclSubject } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";

// 행사 화면의 모든 쓰기. 권한과 값 규칙은 DB 함수가 다시 검사한다(기획서 5.6절).

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function readEventFields(formData: FormData) {
  const name = text(formData, "name");
  const startsRaw = text(formData, "starts_at");
  const endsRaw = text(formData, "ends_at");
  const startsAt = startsRaw ? seoulLocalToIso(startsRaw) : null;
  const endsAt = endsRaw ? seoulLocalToIso(endsRaw) : null;

  const errors: FieldErrors = {};
  if (name.length < 1 || name.length > 100) errors.name = "이름은 1~100자로 입력해 주세요.";
  if (startsRaw && !startsAt) errors.starts_at = "날짜와 시간을 확인해 주세요.";
  if (endsRaw && !endsAt) errors.ends_at = "날짜와 시간을 확인해 주세요.";
  if (startsAt && endsAt && startsAt > endsAt) errors.ends_at = "종료는 시작보다 같거나 늦어야 합니다.";

  return { name, description: text(formData, "description"), startsAt, endsAt, errors };
}

export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/events/new", EVENT_CREATE_ROLES);
  const fields = readEventFields(formData);
  const departmentId = text(formData, "owner_department_id");
  const visibility = text(formData, "visibility_mode") as EventVisibility;
  if (!departmentId) fields.errors.owner_department_id = "담당 국을 선택해 주세요.";
  if (visibility !== "ALL_COUNCIL" && visibility !== "RESTRICTED") {
    fields.errors.visibility_mode = "공개 범위를 선택해 주세요.";
  }
  if (Object.keys(fields.errors).length > 0) return actionFailure("입력값을 확인해 주세요.", fields.errors);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_event", {
    p_term_id: membership.termId,
    p_owner_department_id: departmentId,
    p_name: fields.name,
    p_description: fields.description,
    p_starts_at: fields.startsAt ?? undefined,
    p_ends_at: fields.endsAt ?? undefined,
    p_visibility_mode: visibility,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/events/${data.id}`);
}

async function eventContext(formData: FormData) {
  const eventId = text(formData, "event_id");
  await requireMember(`/events/${eventId}`);
  return { eventId, supabase: await createClient() };
}

function done(error: { code?: string; message?: string } | null, message: string): ActionState {
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(message);
}

export async function updateEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { eventId, supabase } = await eventContext(formData);
  const fields = readEventFields(formData);
  const firstError = Object.values(fields.errors)[0];
  if (firstError) return actionFailure(firstError);
  const { error } = await supabase.rpc("update_event", {
    p_event_id: eventId,
    p_name: fields.name,
    p_description: fields.description,
    p_starts_at: fields.startsAt as string, // null이면 비운다
    p_ends_at: fields.endsAt as string,
    p_manager_id: text(formData, "manager_id"),
  });
  return done(error, "행사 정보를 저장했습니다.");
}

export async function changeEventStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { eventId, supabase } = await eventContext(formData);
  const status = text(formData, "status") as EventStatus;
  if (!EVENT_STATUS_ORDER.includes(status)) return actionFailure("상태를 선택해 주세요.");
  const { error } = await supabase.rpc("change_event_status", { p_event_id: eventId, p_status: status });
  return done(error, "행사 상태를 바꿨습니다.");
}

export async function setEventVisibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { eventId, supabase } = await eventContext(formData);
  const mode = text(formData, "visibility_mode") as EventVisibility;
  if (mode !== "ALL_COUNCIL" && mode !== "RESTRICTED") return actionFailure("공개 범위를 선택해 주세요.");
  const { error } = await supabase.rpc("set_event_visibility", { p_event_id: eventId, p_mode: mode });
  return done(error, "공개 범위를 바꿨습니다.");
}

export async function addEventAccessRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { eventId, supabase } = await eventContext(formData);
  const subject = parseAclSubject(text(formData, "subject"));
  if (!subject) return actionFailure("추가할 열람 대상을 선택해 주세요.");
  const { error } = await supabase.rpc("add_event_access_rule", { p_event_id: eventId, ...subject });
  return done(error, "열람 대상을 추가했습니다.");
}

export async function removeEventAccessRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await eventContext(formData);
  const { error } = await supabase.rpc("remove_event_access_rule", { p_rule_id: text(formData, "rule_id") });
  return done(error, "열람 대상을 뺐습니다.");
}

export async function addEventLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { eventId, supabase } = await eventContext(formData);
  const url = text(formData, "url");
  if (!/^https:\/\/\S+$/.test(url)) return actionFailure("https:// 로 시작하는 주소를 입력해 주세요.");
  if (formData.get("share_checked") !== "on") {
    return actionFailure("원본 서비스의 공유 권한을 확인했는지 체크해 주세요.");
  }
  const { error } = await supabase.rpc("add_event_link", {
    p_event_id: eventId,
    p_title: text(formData, "title"),
    p_url: url,
    p_description: text(formData, "description"),
  });
  return done(error, "링크를 등록했습니다.");
}

// 브라우저가 Storage에 직접 올린 뒤 부른다. 등록에 실패하면 올린 파일을 지운다.
export async function registerEventUpload(eventId: string, title: string, storagePath: string): Promise<ActionState> {
  await requireMember(`/events/${eventId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_event_upload", {
    p_event_id: eventId,
    p_title: title,
    p_storage_path: storagePath,
  });
  if (error) {
    await supabase.storage.from("event-files").remove([storagePath]);
    return actionFailure(rpcErrorMessage(error));
  }
  refresh();
  return actionSuccess("파일을 올렸습니다.");
}

export async function deleteEventResource(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await eventContext(formData);
  const { data: path, error } = await supabase.rpc("delete_event_resource", {
    p_resource_id: text(formData, "resource_id"),
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  // 기록을 먼저 지우고 파일을 정리한다. 파일 삭제가 실패해도 사용자 자료가 엉키지 않는다.
  if (path) await supabase.storage.from("event-files").remove([path]);
  refresh();
  return actionSuccess("자료를 지웠습니다.");
}
