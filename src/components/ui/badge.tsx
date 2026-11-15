import type { ReactNode } from "react";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/labels";
import { MEETING_STATUS_LABELS, type MeetingStatus } from "@/lib/meetings/labels";
import { SUGGESTION_STATUS_LABELS, type SuggestionStatus } from "@/lib/suggestions/labels";

// 상태는 다섯 색과 글자로 구분한다. 기존 tone 이름은 같은 계열로 유지한다.
const TONES = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  strong: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  muted: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  danger: "bg-danger-bg text-danger",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  caution: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  success: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
} as const;

export type BadgeTone = keyof typeof TONES;

// 거르기 버튼처럼 배지가 아닌 곳에도 같은 색을 쓴다
export function badgeToneClass(tone: BadgeTone): string {
  return TONES[tone];
}

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
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[tone]}`}
    >
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

export function TaskStatusBadge({ status }: { status: TaskStatus; }) {
  return <Badge tone={TASK_STATUS_TONES[status]}>{TASK_STATUS_LABELS[status]}</Badge>;
}

// 건의: 접수됨 중립 · 검토 중 파랑 · 답변 완료 초록 · 철회됨 중립
const SUGGESTION_STATUS_TONES: Record<SuggestionStatus, BadgeTone> = {
  RECEIVED: "neutral",
  IN_REVIEW: "info",
  RESOLVED: "success",
  CLOSED: "muted",
};

export function SuggestionStatusBadge({ status }: { status: SuggestionStatus; }) {
  return <Badge tone={SUGGESTION_STATUS_TONES[status]}>{SUGGESTION_STATUS_LABELS[status]}</Badge>;
}

// 회의록: 편집 중 파랑 · 확정 초록 · 보관함 중립
const MEETING_STATUS_TONES: Record<MeetingStatus, BadgeTone> = {
  DRAFT: "info",
  CONFIRMED: "success",
  ARCHIVED: "muted",
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus; }) {
  return <Badge tone={MEETING_STATUS_TONES[status]}>{MEETING_STATUS_LABELS[status]}</Badge>;
}

// 보통은 표시하지 않는다. 높음·낮음만 눈에 띄게 한다.
export function TaskPriorityBadge({ priority }: { priority: TaskPriority; }) {
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
