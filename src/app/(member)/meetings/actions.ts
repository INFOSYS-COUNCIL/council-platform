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
import { MEETING_CREATE_ROLES, MEETING_SCOPES, MEETING_STATUS_ORDER, type MeetingScope, type MeetingStatus } from "@/lib/meetings/labels";
import { templateState } from "@/lib/meetings/ydoc";
import { createClient } from "@/lib/supabase/server";

// 회의록 화면의 쓰기. 권한과 값 규칙은 DB 함수가 다시 검사한다(기획서 6.2·6.8절).
// 본문 저장은 여기를 거치지 않고 브라우저가 save_meeting_update를 바로 부른다(6.4절).

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function ids(formData: FormData, name: string): string[] {
  return formData.getAll(name).map(String).filter(Boolean);
}

export async function createMeeting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/meetings/new", MEETING_CREATE_ROLES);
  const title = text(formData, "title");
  const meetingAt = seoulLocalToIso(text(formData, "meeting_at"));
  const scope = text(formData, "scope") as MeetingScope;
  const departmentIds = ids(formData, "department_ids");
  const authorId = text(formData, "author_id");
  const templateId = text(formData, "template_id");

  const errors: FieldErrors = {};
  if (title.length < 1 || title.length > 100) errors.title = "제목은 1~100자로 입력해 주세요.";
  if (!meetingAt) errors.meeting_at = "회의 일시를 입력해 주세요.";
  if (!MEETING_SCOPES.includes(scope)) errors.scope = "열람 범위를 하나 선택해 주세요.";
  if (scope === "DEPARTMENTS" && departmentIds.length === 0) errors.scope = "열람할 국을 하나 이상 선택해 주세요.";
  if (!authorId) errors.author_id = "대표 작성자를 선택해 주세요.";
  if (Object.keys(errors).length > 0) return actionFailure("입력값을 확인해 주세요.", errors);

  const supabase = await createClient();
  let blocks: unknown = [];
  if (templateId) {
    const { data } = await supabase.from("meeting_templates").select("blocks").eq("id", templateId).maybeSingle();
    if (!data) return actionFailure("입력값을 확인해 주세요.", { template_id: "사용할 수 없는 템플릿입니다." });
    blocks = data.blocks;
  }
  let initial;
  try {
    initial = templateState(blocks);
  } catch {
    return actionFailure("템플릿 본문을 읽지 못했습니다. 회장단에게 템플릿 수정을 요청해 주세요.");
  }

  const { data, error } = await supabase.rpc("create_meeting", {
    p_term_id: membership.termId,
    p_title: title,
    p_meeting_at: meetingAt!,
    p_author_id: authorId,
    p_editor_ids: ids(formData, "editor_ids"),
    p_scope: scope,
    p_department_ids: scope === "DEPARTMENTS" ? departmentIds : [],
    p_state: initial.state,
    p_state_vector: initial.vector,
    p_template_id: templateId || undefined,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/meetings/${data.id}`);
}

async function meetingContext(formData: FormData) {
  const meetingId = text(formData, "meeting_id");
  await requireMember(`/meetings/${meetingId}`);
  return { meetingId, supabase: await createClient() };
}

function done(error: { code?: string; message?: string } | null, message: string): ActionState {
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(message);
}

export async function updateMeeting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { meetingId, supabase } = await meetingContext(formData);
  const meetingAt = seoulLocalToIso(text(formData, "meeting_at"));
  if (!meetingAt) return actionFailure("회의 일시를 입력해 주세요.");
  const { error } = await supabase.rpc("update_meeting", {
    p_meeting_id: meetingId,
    p_title: text(formData, "title"),
    p_meeting_at: meetingAt,
  });
  if (error) return actionFailure(rpcErrorMessage(error));

  // 열람 범위 칸이 있는 폼(상세 화면)에서 범위가 바뀌었을 때만
  if (formData.has("scope")) {
    const scope = text(formData, "scope") as MeetingScope;
    const departmentIds = scope === "DEPARTMENTS" ? ids(formData, "department_ids") : [];
    if (!MEETING_SCOPES.includes(scope)) return actionFailure("열람 범위를 하나 선택해 주세요.");
    if (`${scope}:${[...departmentIds].sort().join(",")}` !== text(formData, "orig_scope")) {
      const { error: scopeError } = await supabase.rpc("set_meeting_scope", {
        p_meeting_id: meetingId,
        p_scope: scope,
        p_department_ids: departmentIds,
      });
      if (scopeError) return actionFailure(rpcErrorMessage(scopeError));
    }
  }
  return done(null, "회의 정보를 저장했습니다.");
}

export async function setMeetingAuthor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { meetingId, supabase } = await meetingContext(formData);
  const { error } = await supabase.rpc("set_meeting_author", { p_meeting_id: meetingId, p_author_id: text(formData, "user_id") });
  return done(error, "대표 작성자를 바꿨습니다.");
}

export async function addMeetingEditor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { meetingId, supabase } = await meetingContext(formData);
  const userId = text(formData, "user_id");
  if (!userId) return actionFailure("추가할 편집자를 선택해 주세요.");
  const { error } = await supabase.rpc("add_meeting_editor", { p_meeting_id: meetingId, p_user_id: userId });
  return done(error, "편집자를 추가했습니다.");
}

export async function removeMeetingEditor(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { meetingId, supabase } = await meetingContext(formData);
  const { error } = await supabase.rpc("remove_meeting_editor", { p_meeting_id: meetingId, p_user_id: text(formData, "user_id") });
  return done(error, "편집자에서 뺐습니다.");
}

export async function changeMeetingStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { meetingId, supabase } = await meetingContext(formData);
  const status = text(formData, "status") as MeetingStatus;
  if (status !== "DRAFT" && status !== "ARCHIVED") return actionFailure("바꿀 상태를 선택해 주세요.");
  const { error } = await supabase.rpc("change_meeting_status", {
    p_meeting_id: meetingId,
    p_status: status,
    p_reason: text(formData, "reason") || undefined,
  });
  return done(error, status === "ARCHIVED" ? "보관함으로 옮겼습니다." : "다시 편집할 수 있게 열었습니다.");
}

// 회의록 삭제: 회장단 또는 만든 사람·대표 작성자인 국장(DB 함수가 검사). 지운 뒤 그 회의록이 있던 목록 탭으로 간다.
export async function deleteMeeting(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { meetingId, supabase } = await meetingContext(formData);
  const { error } = await supabase.rpc("delete_meeting", { p_meeting_id: meetingId });
  if (error) return actionFailure(rpcErrorMessage(error));
  const tab = MEETING_STATUS_ORDER.find((s) => s === text(formData, "status_tab")) ?? "DRAFT";
  redirect(`/meetings?status=${tab}`);
}
