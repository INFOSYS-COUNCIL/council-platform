import type { ReactNode } from "react";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/labels";
import { MEETING_STATUS_LABELS, type MeetingStatus } from "@/lib/meetings/labels";
import { SUGGESTION_STATUS_LABELS, type SuggestionStatus } from "@/lib/suggestions/labels";

// Linear처럼 얇은 테두리 + 앞쪽 점으로 상태를 구분한다.
const TONES = {
  neutral: "border-zinc-300 bg-white text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300",
  strong: "border-coral-200 bg-coral-50 text-coral-900 dark:border-coral-900 dark:bg-coral-900/40 dark:text-coral-200",
  muted: "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400",
  danger: "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200",
  warning: "border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200",
  caution: "border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  success: "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
} as const;

export type BadgeTone = keyof typeof TONES;

// 거르기 버튼처럼 배지가 아닌 곳에도 같은 색을 쓴다
export function badgeToneClass(tone: BadgeTone): string {
  return TONES[tone];
}

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-zinc-400",
  strong: "bg-coral-500",
  muted: "bg-zinc-300 dark:bg-zinc-600",
  danger: "bg-red-500",
  info: "bg-blue-500",
  warning: "bg-orange-500",
  caution: "bg-yellow-500",
  success: "bg-green-500",
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

// 상태마다 색을 달리한다(2차 QA): 시작 전 회색 · 진행 중 파랑 · 검토 요청 주황 · 완료 초록
export const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = {
  TODO: "neutral",
  IN_PROGRESS: "info",
  REVIEW: "warning",
  DONE: "success",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

// 건의: 접수됨 노랑 · 검토 중 파랑 · 답변 완료 초록 · 철회됨 흐리게
const SUGGESTION_STATUS_TONES: Record<SuggestionStatus, BadgeTone> = {
  RECEIVED: "caution",
  IN_REVIEW: "info",
  RESOLVED: "success",
  CLOSED: "muted",
};

export function SuggestionStatusBadge({ status }: { status: SuggestionStatus }) {
  return <Badge tone={SUGGESTION_STATUS_TONES[status]}>{SUGGESTION_STATUS_LABELS[status]}</Badge>;
}

// 회의록: 편집 중 주황 · 보관함 흐리게
const MEETING_STATUS_TONES: Record<MeetingStatus, BadgeTone> = {
  DRAFT: "warning",
  CONFIRMED: "success",
  ARCHIVED: "muted",
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <Badge tone={MEETING_STATUS_TONES[status]}>{MEETING_STATUS_LABELS[status]}</Badge>;
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
