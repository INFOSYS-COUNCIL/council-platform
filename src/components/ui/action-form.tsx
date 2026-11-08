"use client";

import { useActionState, type ReactNode } from "react";
import {
  initialActionState,
  type ActionState,
} from "@/lib/actions/result";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

// 칸별 오류가 필요 없는 짧은 폼(상태 변경, 삭제, 한두 칸 수정)에 쓴다.
// confirmMessage를 주면 되돌릴 수 없는 작업처럼 제출 전에 한 번 더 묻는다(기획서 부록 C.2).
export function ActionForm({
  action,
  submitLabel,
  pendingLabel,
  variant,
  confirmMessage,
  className = "space-y-3",
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  confirmMessage?: string;
  className?: string;
  children?: ReactNode;
}) {
  const [state, formAction] = useActionState(action, initialActionState);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
      <SubmitButton pendingLabel={pendingLabel} variant={variant}>
        {submitLabel}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
