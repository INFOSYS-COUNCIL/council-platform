"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";

// <form action={...}> 안에서 쓰는 제출 버튼. 처리 중에는 눌리지 않고 문구가 바뀐다.
export function SubmitButton({
  children,
  pendingLabel = "처리 중…",
  variant = "primary",
}: {
  children: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary";
}) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
