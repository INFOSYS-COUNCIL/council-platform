import Link from "next/link";
import type { ComponentProps } from "react";

export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// 버튼처럼 보이는 링크. <button> 안에 링크를 넣지 않도록 따로 둔다(접근성).
export function LinkButton({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-block rounded-md bg-coral-700 px-4 py-2 font-medium text-white hover:bg-coral-800 dark:bg-coral-400 dark:text-zinc-950 dark:hover:bg-coral-300 ${FOCUS_RING} ${className}`}
      {...props}
    />
  );
}
