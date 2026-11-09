import type { ReactNode } from "react";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/labels";

// Linear처럼 얇은 테두리 + 앞쪽 점으로 상태를 구분한다.
const TONES = {
  neutral: "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  strong: "border-coral-200 bg-coral-50 text-coral-900 dark:border-coral-900 dark:bg-coral-900/40 dark:text-coral-200",
  muted: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
} as const;

const DOTS: Record<keyof typeof TONES, string> = {
  neutral: "bg-zinc-400",
  strong: "bg-coral-500",
  muted: "bg-zinc-300 dark:bg-zinc-600",
  danger: "bg-red-500",
};

// 짧은 상태 표시. 색만으로 뜻을 전하지 않도록 항상 글자를 함께 쓴다.
export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONES[tone]}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${DOTS[tone]}`} />
      {children}
    </span>
  );
}

const STATUS_TONES: Record<TaskStatus, keyof typeof TONES> = {
  TODO: "neutral",
  IN_PROGRESS: "strong",
  REVIEW: "neutral",
  DONE: "muted",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

// 보통은 표시하지 않는다. 높음·낮음만 눈에 띄게 한다.
export function TaskPriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "NORMAL") return null;
  return (
    <Badge tone={priority === "HIGH" ? "danger" : "muted"}>
      우선순위 {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function OverdueBadge() {
  return <Badge tone="danger">기한 초과</Badge>;
}

// 담당자 소속이 종료된 업무 (기획서 1.5절: 재배정 필요 표시)
export function InactiveAssigneeBadge() {
  return <Badge tone="danger">담당자 비활성</Badge>;
}
