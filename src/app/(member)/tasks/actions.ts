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
import { parseAclSubject } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import {
  TASK_CREATE_ROLES,
  TASK_PRIORITY_ORDER,
  TASK_STATUS_ORDER,
  type TaskPriority,
  type TaskStatus,
  type VisibilityMode,
} from "@/lib/tasks/labels";

// 업무 화면의 모든 쓰기. 권한과 값 규칙은 DB 함수가 다시 검사하므로 여기서는
// 입력 형태만 확인하고, 실패하면 함수가 돌려준 한국어 이유를 그대로 보여 준다.

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function optional(formData: FormData, name: string): string | null {
  return text(formData, name) || null;
}

function readTaskFields(formData: FormData) {
  const title = text(formData, "title");
  const priority = text(formData, "priority") as TaskPriority;
  const startDate = optional(formData, "start_date");
  const dueDate = optional(formData, "due_date");

  const errors: FieldErrors = {};
  if (title.length < 1 || title.length > 100) errors.title = "제목은 1~100자로 입력해 주세요.";
  if (!TASK_PRIORITY_ORDER.includes(priority)) errors.priority = "우선순위를 선택해 주세요.";
  if (startDate && !DATE.test(startDate)) errors.start_date = "날짜 형식이 올바르지 않습니다.";
  if (dueDate && !DATE.test(dueDate)) errors.due_date = "날짜 형식이 올바르지 않습니다.";
  if (startDate && dueDate && startDate > dueDate) errors.due_date = "마감일은 시작일보다 같거나 늦어야 합니다.";

  return {
    title,
    priority,
    startDate,
    dueDate,
    assigneeId: optional(formData, "assignee_id"),
    errors,
  };
}

export async function createTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/tasks/new", TASK_CREATE_ROLES);
  const fields = readTaskFields(formData);
  const departmentId = text(formData, "department_id");
  const visibility = text(formData, "visibility_mode") as VisibilityMode;
  if (!departmentId) fields.errors.department_id = "담당 국을 선택해 주세요.";
  if (visibility !== "DEFAULT" && visibility !== "RESTRICTED") {
    fields.errors.visibility_mode = "공개 모드를 선택해 주세요.";
  }
  if (Object.keys(fields.errors).length > 0) {
    return actionFailure("입력값을 확인해 주세요.", fields.errors);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_task", {
    p_term_id: membership.termId,
    p_department_id: departmentId,
    p_title: fields.title,
    p_description: text(formData, "description"),
    p_assignee_id: fields.assigneeId ?? undefined,
    p_priority: fields.priority,
    p_start_date: fields.startDate ?? undefined,
    p_due_date: fields.dueDate ?? undefined,
    p_visibility_mode: visibility,
  });
  if (error) return actionFailure(rpcErrorMessage(error));

  redirect(`/tasks/${data.id}`);
}

// 아래 함수들은 상세 화면의 폼이 hidden 입력으로 task_id를 보낸다.
async function taskContext(formData: FormData) {
  const taskId = text(formData, "task_id");
  await requireMember(`/tasks/${taskId}`);
  return { taskId, supabase: await createClient() };
}

function done(error: { code?: string; message?: string } | null, message: string): ActionState {
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(message);
}

export async function updateTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const fields = readTaskFields(formData);
  const firstError = Object.values(fields.errors)[0];
  if (firstError) return actionFailure(firstError);

  const { error } = await supabase.rpc("update_task", {
    p_task_id: taskId,
    p_title: fields.title,
    p_assignee_id: fields.assigneeId as string, // null이면 담당자 없음
    p_priority: fields.priority,
    p_start_date: fields.startDate as string,
    p_due_date: fields.dueDate as string,
  });
  return done(error, "업무 정보를 저장했습니다.");
}

export async function updateTaskDescription(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const { error } = await supabase.rpc("update_task_description", {
    p_task_id: taskId,
    p_description: String(formData.get("description") ?? ""),
  });
  return done(error, "설명을 저장했습니다.");
}

export async function changeTaskStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const status = text(formData, "status") as TaskStatus;
  if (!TASK_STATUS_ORDER.includes(status)) return actionFailure("상태를 선택해 주세요.");
  const { error } = await supabase.rpc("change_task_status", { p_task_id: taskId, p_status: status });
  const message = status === "REVIEW" ? "국장에게 검토를 요청했습니다." : status === "DONE" ? "완료 처리했습니다." : "상태를 바꿨습니다.";
  return done(error, message);
}

export async function setTaskVisibility(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const mode = text(formData, "visibility_mode") as VisibilityMode;
  if (mode !== "DEFAULT" && mode !== "RESTRICTED") return actionFailure("공개 모드를 선택해 주세요.");
  const { error } = await supabase.rpc("set_task_visibility", { p_task_id: taskId, p_mode: mode });
  return done(error, "공개 모드를 바꿨습니다.");
}

// 열람 대상 값은 "DEPARTMENT:<id>", "USER:<id>", "ROLE_GROUP:<그룹>" 하나로 받는다.
export async function addTaskAccessRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const subject = parseAclSubject(text(formData, "subject"));
  if (!subject) return actionFailure("추가할 열람 대상을 선택해 주세요.");
  const { error } = await supabase.rpc("add_task_access_rule", { p_task_id: taskId, ...subject });
  return done(error, "열람 대상을 추가했습니다.");
}

export async function removeTaskAccessRule(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase } = await taskContext(formData);
  const { error } = await supabase.rpc("remove_task_access_rule", { p_rule_id: text(formData, "rule_id") });
  return done(error, "열람 대상을 뺐습니다.");
}

export async function setTaskManager(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const managerId = text(formData, "manager_id");
  if (!managerId) return actionFailure("관리 책임자를 선택해 주세요.");
  const { error } = await supabase.rpc("set_task_manager", { p_task_id: taskId, p_manager_id: managerId });
  return done(error, "관리 책임자를 바꿨습니다.");
}

export async function archiveTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const { error } = await supabase.rpc("archive_task", { p_task_id: taskId });
  return done(error, "업무를 보관했습니다.");
}

export async function restoreTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const { error } = await supabase.rpc("restore_task", { p_task_id: taskId });
  return done(error, "업무를 복원했습니다.");
}

// 삭제: 보관과 같은 권한. 되돌릴 수 없으므로 화면에서 한 번 더 확인한다.
export async function deleteTask(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { taskId, supabase } = await taskContext(formData);
  const { error } = await supabase.rpc("delete_task", { p_task_id: taskId });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect("/tasks");
}
