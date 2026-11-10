import type { ReactNode } from "react";

// 상세 화면의 구역 제목과 "이름: 값" 표시. h1은 PageHeader가 쓰므로 구역은 h2다.
// action: 소제목 오른쪽에 두는 작은 버튼(예: "+ 일정 추가")
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3">
      {/* 소제목은 본문보다 크고 진하게, 왼쪽 코랄 막대로 구획을 드러낸다 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="border-l-4 border-coral-500 pl-2.5 text-lg font-bold text-zinc-950 dark:text-zinc-50">{title}</h2>
        {action}
      </div>
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
