import type { ReactNode } from "react";

// 상세 화면의 구역 제목과 "이름: 값" 표시. h1은 PageHeader가 쓰므로 구역은 h2다.
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function InfoList({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </dl>
  );
}

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

export function Skeleton({ className = "h-96" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900 ${className}`} />;
}
