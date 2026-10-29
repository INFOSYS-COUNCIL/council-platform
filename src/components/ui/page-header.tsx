import type { ReactNode } from "react";

// 화면 제목. 한 화면에 h1은 이것 하나만 둔다.
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
      {actions}
    </div>
  );
}
