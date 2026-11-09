import Link from "next/link";
import type { ComponentProps } from "react";

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// 버튼처럼 보이는 링크. <button> 안에 링크를 넣지 않도록 따로 둔다(접근성).
export function LinkButton({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-coral-700 px-3.5 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-800 dark:bg-coral-400 dark:text-zinc-950 dark:hover:bg-coral-300 ${FOCUS_RING} ${className}`}
      {...props}
    />
  );
}

// 테두리 버튼처럼 보이는 링크(돌아가기·보조 이동). 주된 동작은 LinkButton을 쓴다.
export function SecondaryLinkButton({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3.5 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${FOCUS_RING} ${className}`}
      {...props}
    />
  );
}
