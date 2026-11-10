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
import { requireMember, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTION_STATUS_ORDER, type SuggestionStatus } from "@/lib/suggestions/labels";

// 건의 제출·철회(작성자)와 처리(배정된 처리자·회장단). 권한은 DB 함수가 검사한다(기획서 7장).

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function done(error: { code?: string; message?: string } | null, message: string): ActionState {
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(message);
}

export async function submitSuggestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/suggestions/new");
  const title = text(formData, "title");
  const content = text(formData, "content");
  // 폼을 열 때 만든 요청 번호. 두 번 눌러도 건의는 하나만 생긴다
  const requestId = text(formData, "request_id");

  const errors: FieldErrors = {};
  if (title.length < 1 || title.length > 100) errors.title = "제목은 1~100자로 입력해 주세요.";
  if (content.length < 1 || content.length > 3000) errors.content = "내용은 1~3000자로 입력해 주세요.";
  if (!UUID.test(requestId)) return actionFailure("화면을 새로고침한 뒤 다시 제출해 주세요.");
  if (Object.keys(errors).length > 0) return actionFailure("입력값을 확인해 주세요.", errors);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_suggestion", {
    p_title: title,
    p_content: content,
    p_request_id: requestId,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/suggestions/${data}`);
}

export async function withdrawSuggestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/suggestions");
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_suggestion", { p_suggestion_id: text(formData, "suggestion_id") });
  return done(error, "건의를 철회했습니다.");
}

async function handlerContext(formData: FormData) {
  const id = text(formData, "suggestion_id");
  await requireMember(`/council/suggestions/${id}`);
  return { id, supabase: await createClient() };
}

export async function addSuggestionMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { id, supabase } = await handlerContext(formData);
  const type = text(formData, "message_type") === "AUTHOR_VISIBLE" ? "AUTHOR_VISIBLE" : "INTERNAL";
  const { error } = await supabase.rpc("add_suggestion_message", {
    p_suggestion_id: id,
    p_type: type,
    p_body: text(formData, "body"),
  });
  return done(error, type === "AUTHOR_VISIBLE" ? "작성자에게 답변을 남겼습니다." : "내부 메모를 남겼습니다.");
}

export async function changeSuggestionStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { id, supabase } = await handlerContext(formData);
  const status = text(formData, "status") as SuggestionStatus;
  if (!SUGGESTION_STATUS_ORDER.includes(status)) return actionFailure("상태를 선택해 주세요.");
  const { error } = await supabase.rpc("change_suggestion_status", { p_suggestion_id: id, p_status: status });
  return done(error, "상태를 바꿨습니다.");
}

export async function assignSuggestion(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { id, supabase } = await handlerContext(formData);
  const { error } = await supabase.rpc("assign_suggestion", {
    p_suggestion_id: id,
    p_department_id: text(formData, "department_id") || (null as unknown as string),
    p_user_id: text(formData, "user_id") || (null as unknown as string),
  });
  return done(error, "배정을 바꿨습니다.");
}

// 답변·메모 수정·삭제: 쓴 사람(처리자일 때) 또는 회장단만. DB 함수가 검사한다.
export async function updateSuggestionMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await handlerContext(formData);
  const { error } = await supabase.rpc("update_suggestion_message", {
    p_message_id: text(formData, "message_id"),
    p_body: text(formData, "body"),
  });
  return done(error, "글을 고쳤습니다.");
}

export async function deleteSuggestionMessage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await handlerContext(formData);
  const { error } = await supabase.rpc("delete_suggestion_message", { p_message_id: text(formData, "message_id") });
  return done(error, "글을 지웠습니다.");
}
