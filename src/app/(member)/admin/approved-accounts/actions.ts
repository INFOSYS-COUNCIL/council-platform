"use server";

import { refresh } from "next/cache";
import {
  actionFailure,
  actionSuccess,
  rpcErrorMessage,
  UNKNOWN_ERROR_MESSAGE,
  type ActionState,
} from "@/lib/actions/result";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLE_ORDER } from "@/lib/auth/roles";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_BATCH_ROWS,
  parseBulkInput,
  STUDENT_NO_ERROR,
  STUDENT_NO_PATTERN,
} from "./bulk-input";
import { readOrganisation } from "./queries";

const ROUTE = ADMIN_ROUTES.approvedAccounts;

type RowResult = { rowNo: number; email: string; error: string | null };
export type BulkState = { result: ActionState; rows?: RowResult[]; retryInput?: string };

export async function registerAccounts(termId: string, form: FormData): Promise<BulkState> {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  if (termId !== membership.termId) {
    return { result: actionFailure("현재 기수가 바뀌었습니다. 페이지를 새로고침해 주세요.") };
  }

  const supabase = await createClient();
  const organisation = await readOrganisation(supabase, membership.termId);
  if (!organisation) return { result: actionFailure("부서와 직책을 불러오지 못했습니다.") };

  const rows = parseBulkInput(String(form.get("accounts") ?? ""), {
    departments: organisation.departments.filter(({ is_active }) => is_active),
    positions: organisation.positions.filter(({ is_active }) => is_active),
    director: membership.role === "DIRECTOR" ? { departmentId: membership.departmentId } : null,
  });
  if (rows.length > MAX_BATCH_ROWS) {
    return { result: actionFailure(`한 번에 ${MAX_BATCH_ROWS}행까지 등록할 수 있습니다.`) };
  }
  if (!rows.length) return { result: actionFailure("등록할 명단을 입력해 주세요.") };

  const validRows = rows.filter((row) => "registration" in row);
  const submittedResults = new Map<number, RowResult>();
  if (validRows.length) {
    const { data, error } = await supabase.rpc("register_approved_accounts", {
      p_term_id: membership.termId,
      p_rows: validRows.map(({ registration }) => registration),
    });
    if (error) return { result: actionFailure(rpcErrorMessage(error)) };

    for (const result of data) {
      const original = validRows[result.row_no - 1];
      if (!original) continue;
      submittedResults.set(original.rowNo, {
        rowNo: original.rowNo,
        email: original.email,
        error: result.account_id ? null : rpcErrorMessage({ message: result.error }),
      });
    }
  }

  const results = rows.map(({ rowNo, email, ...row }) =>
    submittedResults.get(rowNo) ??
      { rowNo, email, error: "error" in row ? row.error : UNKNOWN_ERROR_MESSAGE },
  );
  const failed = new Set(results.filter(({ error }) => error !== null).map(({ rowNo }) => rowNo));
  const succeeded = results.length - failed.size;
  if (succeeded) refresh();

  return {
    result: failed.size
      ? actionFailure(`${succeeded}행 등록, ${failed.size}행 실패. 실패한 행을 고쳐 다시 시도해 주세요.`)
      : actionSuccess(`${succeeded}행을 등록했습니다.`),
    rows: results,
    retryInput: rows.filter(({ rowNo }) => failed.has(rowNo)).map(({ source }) => source).join("\n"),
  };
}

export async function updateAccount(_previous: ActionState, form: FormData): Promise<ActionState> {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const director = membership.role === "DIRECTOR";
  const role = director ? "MEMBER" : ROLE_ORDER.find((value) => value === form.get("role"));
  if (!role) return actionFailure("역할을 선택해 주세요.");

  const departmentId = director
    ? membership.departmentId
    : String(form.get("departmentId") ?? "") || null;
  if (!departmentId && role !== "EXECUTIVE") {
    return actionFailure("부서를 선택해 주세요.", { departmentId: "부서를 선택해 주세요." });
  }

  const args = {
    p_account_id: String(form.get("accountId") ?? ""),
    p_role: role,
    ...(departmentId ? { p_department_id: departmentId } : {}),
    p_position_id: String(form.get("positionId") ?? "") || undefined,
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_approved_account", args);
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("승인 정보를 수정했습니다.");
}

export async function cancelAccount(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  if (form.get("confirm") !== "yes") return actionFailure("취소 대상을 확인해 주세요.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_approved_account", {
    p_account_id: String(form.get("accountId") ?? ""),
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("승인 등록을 취소했습니다.");
}

export async function correctStudentNo(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const studentNo = String(form.get("studentNo") ?? "").trim();
  if (!STUDENT_NO_PATTERN.test(studentNo)) {
    return actionFailure("학번을 확인해 주세요.", { studentNo: STUDENT_NO_ERROR });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_approved_student_no", {
    p_account_id: String(form.get("accountId") ?? ""),
    p_student_no: studentNo,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("학번을 정정했습니다.");
}

// 로그인 전 행(대기·등록 취소)만 지운다. 같은 이메일을 다시 등록할 수 있게 된다.
export async function deleteAccount(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  if (form.get("confirm") !== "yes") return actionFailure("삭제 대상을 확인해 주세요.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_approved_account", {
    p_account_id: String(form.get("accountId") ?? ""),
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("승인 행을 삭제했습니다.");
}
