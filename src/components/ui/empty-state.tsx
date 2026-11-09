import type { ReactNode } from "react";

// 빈 목록 표시 (기획서 부록 C.2). action에는 만들 권한이 있는 사용자에게만 버튼을 넘긴다.
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
      <span
        aria-hidden="true"
        className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      >
        <svg viewBox="0 0 16 16" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 9 4 3.5h8L13.5 9v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" />
          <path d="M2.5 9H6l.5 1.5h3L10 9h3.5" />
        </svg>
      </span>
      <p className="font-medium">{title}</p>
      {description && (
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
