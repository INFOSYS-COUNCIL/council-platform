// Server Action이 화면에 돌려주는 결과와 DB 오류를 사용자 문장으로 바꾸는 함수.
// Client Component의 useActionState와 Server Action이 함께 쓰므로 server-only가 아니다.
//
// 사용 예 (actions.ts):
//   "use server";
//   export async function createDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
//     const membership = await requireMember("/admin/departments", ADMIN_ROUTES.departments.roles);
//     const name = String(formData.get("name") ?? "").trim();
//     if (!name) return actionFailure("입력값을 확인해 주세요.", { name: "부서 이름을 입력해 주세요." });
//     const supabase = await createClient();
//     const { error } = await supabase.rpc("create_department", { p_term_id: membership.termId, p_name: name });
//     if (error) return actionFailure(rpcErrorMessage(error));
//     refresh();
//     return actionSuccess("부서를 추가했습니다.");
//   }

export type FieldErrors = Partial<Record<string, string>>;

export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export const initialActionState: ActionState = { status: "idle" };

export function actionSuccess(message: string): ActionState {
  return { status: "success", message };
}

export function actionFailure(
  message: string,
  fieldErrors?: FieldErrors,
): ActionState {
  return fieldErrors
    ? { status: "error", message, fieldErrors }
    : { status: "error", message };
}

type DbError = { code?: string | null; message?: string | null };

const HANGUL = /[가-힣]/;

// 코드별 기본 문장. Postgres 원문(영어, 테이블 이름 포함)은 화면에 그대로 보여 주지 않는다.
const MESSAGES_BY_CODE: Record<string, string> = {
  "42501": "이 작업을 할 권한이 없습니다.",
  "23505": "이미 같은 값이 있습니다.",
  "23514": "입력값이 규칙에 맞지 않습니다.",
  "23503": "연결된 항목이 있어 처리할 수 없습니다.",
  "22023": "입력값을 확인해 주세요.",
  "55000": "지금 상태에서는 처리할 수 없습니다.",
};

export const UNKNOWN_ERROR_MESSAGE =
  "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

// 우리 DB 함수는 raise exception에 한국어 이유를 적는다. 그 문장은 그대로 보여 주고,
// 그 밖의 오류는 코드별 기본 문장으로 바꾼다.
export function rpcErrorMessage(error: DbError): string {
  const message = error.message?.trim();
  if (message && HANGUL.test(message)) return message;
  return (error.code && MESSAGES_BY_CODE[error.code]) || UNKNOWN_ERROR_MESSAGE;
}
