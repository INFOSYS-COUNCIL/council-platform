import type { ReactNode } from "react";

const TONES = {
  error:
    "border-transparent bg-danger-bg text-danger",
  info: "border-zinc-200 bg-surface text-foreground dark:border-zinc-800",
} as const;

// 오류는 스크린리더가 바로 읽도록 role="alert", 안내는 role="status"로 둔다.
export function Alert({
  tone = "error",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-lg border px-3.5 py-3 text-sm ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
