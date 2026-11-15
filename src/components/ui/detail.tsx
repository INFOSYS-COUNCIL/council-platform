import type { ReactNode } from "react";

// 상세 화면의 구역 제목과 "이름: 값" 표시. h1은 PageHeader가 쓰므로 구역은 h2다.
// action: 소제목 오른쪽에 두는 작은 버튼(예: "+ 일정 추가")
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode; }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InfoList({ children }: { children: ReactNode; }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 rounded-xl border border-zinc-200 bg-surface p-5 sm:grid-cols-2 dark:border-zinc-800">
      {children}
    </dl>
  );
}

export function Info({ label, children }: { label: string; children: ReactNode; }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

export function Skeleton({ className = "h-96" }: { className?: string; }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900 ${className}`} />;
}
