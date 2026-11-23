"use server";

import { refresh } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { SEMESTER_PATTERN } from "@/lib/finance/labels";
import { createClient } from "@/lib/supabase/server";

// 재무국 업무 쓰기. 권한과 값 규칙은 DB 함수가 다시 검사한다(재무국 구성원·국장·회장단, 민감 문서 등).

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
type Result = { error?: string; id?: string };
const none = null as unknown as string;

export async function setFinanceDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/finance", ["EXECUTIVE"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_finance_department", { p_department_id: text(formData, "department_id") });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("재무 담당 부서를 저장했습니다.");
}

export async function saveFinanceForm(input: { id?: string; name: string; sensitive: boolean; filePath?: string; fileName?: string }): Promise<Result> {
  const membership = await requireMember("/finance");
  if (input.name.trim().length < 1 || input.name.trim().length > 80) return { error: "양식 이름은 1~80자로 입력해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_finance_form", {
    p_id: input.id ?? none,
    p_term_id: membership.termId,
    p_name: input.name,
    p_sensitive: input.sensitive,
    p_file_path: input.filePath ?? none,
    p_file_name: input.fileName ?? none,
  });
  if (error) return { error: rpcErrorMessage(error) };
  refresh();
  return { id: data };
}

export async function createFinanceDoc(input: {
  formId: string;
  title: string;
  semester: string;
  baseDate: string;
  assigneeId: string;
  requestId: string;
}): Promise<Result> {
  await requireMember("/finance");
  if (!input.title.trim()) return { error: "제목을 입력해 주세요." };
  if (!SEMESTER_PATTERN.test(input.semester)) return { error: "학기는 2026-2처럼 입력해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_finance_doc", {
    p_form_id: input.formId,
    p_title: input.title,
    p_semester: input.semester,
    p_base_date: input.baseDate || none,
    p_assignee_id: input.assigneeId || none,
    p_request_id: input.requestId,
  });
  if (error) return { error: rpcErrorMessage(error) };
  return { id: data };
}

export async function assignFinanceDoc(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/finance", ["DIRECTOR", "EXECUTIVE"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_finance_doc", {
    p_doc_id: text(formData, "doc_id"),
    p_assignee_id: text(formData, "assignee_id") || none,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("담당자를 지정했습니다.");
}

export async function addFinanceDocVersion(input: { docId: string; filePath: string; fileName: string; note: string }): Promise<Result> {
  await requireMember(`/finance/docs/${input.docId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_finance_doc_version", {
    p_doc_id: input.docId,
    p_file_path: input.filePath,
    p_file_name: input.fileName,
    p_note: input.note,
  });
  if (error) return { error: rpcErrorMessage(error) };
  refresh();
  return {};
}

export async function importFinanceDoc(input: {
  title: string;
  semester: string;
  baseDate: string;
  sensitive: boolean;
  filePath: string;
  fileName: string;
}): Promise<Result> {
  const membership = await requireMember("/finance", ["DIRECTOR", "EXECUTIVE"]);
  if (!SEMESTER_PATTERN.test(input.semester)) return { error: "학기는 2026-2처럼 입력해 주세요." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_finance_doc", {
    p_term_id: membership.termId,
    p_title: input.title,
    p_semester: input.semester,
    p_base_date: input.baseDate || none,
    p_sensitive: input.sensitive,
    p_file_path: input.filePath,
    p_file_name: input.fileName,
  });
  if (error) return { error: rpcErrorMessage(error) };
  refresh();
  return { id: data };
}
