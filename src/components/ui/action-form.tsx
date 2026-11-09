"use client";

import { startTransition, useActionState, useEffect, useRef, type ReactNode } from "react";
import { initialActionState, type ActionState } from "@/lib/actions/result";
import { Button } from "./button";
import { FormMessage } from "./form-message";

// 칸별 오류가 필요 없는 짧은 폼(상태 변경, 삭제, 한두 칸 수정)에 쓴다.
// confirmMessage를 주면 되돌릴 수 없는 작업처럼 제출 전에 한 번 더 묻는다(기획서 부록 C.2).
// <form action>은 제출 뒤 입력을 항상 비우므로 직접 제출해, 실패하면 입력을 그대로 두고
// 성공했을 때만 비운다(부록 C.2 "실패하면 입력한 내용을 그대로 둔다").
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "처리 중…",
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
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirmMessage && !window.confirm(confirmMessage)) return;
        const formData = new FormData(e.currentTarget);
        startTransition(() => formAction(formData));
      }}
    >
      {children}
      <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
