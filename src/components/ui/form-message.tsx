import type { ActionState } from "@/lib/actions/result";
import { Alert } from "./alert";

// Server Action 결과 문장. 성공은 안내(status), 실패는 오류(alert)로 읽힌다.
// 칸별 오류(fieldErrors)는 각 입력칸의 error로 따로 넘긴다.
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  return (
    <Alert tone={state.status === "error" ? "error" : "info"}>
      {state.message}
    </Alert>
  );
}
