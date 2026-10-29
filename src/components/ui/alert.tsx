import type { ReactNode } from "react";

const TONES = {
  error:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200",
  info: "border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
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
      className={`rounded-md border p-3 text-sm ${TONES[tone]}`}
    >
      {children}
    </p>
  );
}
