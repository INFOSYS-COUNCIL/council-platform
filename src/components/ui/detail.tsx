import type { ReactNode } from "react";

// 상세 화면의 구역 제목과 "이름: 값" 표시. h1은 PageHeader가 쓰므로 구역은 h2다.
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function InfoList({ children }: { children: ReactNode }) {
  return (
    <dl className="grid gap-4 rounded-md border border-zinc-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </dl>
  );
}

export function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-zinc-600 dark:text-zinc-400">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}

export function Skeleton({ className = "h-96" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900 ${className}`} />;
}
