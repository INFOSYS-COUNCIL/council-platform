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
    <div className="space-y-3 rounded-md border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {description && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      )}
      {action}
    </div>
  );
}
