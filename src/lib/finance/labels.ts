import type { TaskStatus } from "@/lib/tasks/labels";

// 재무 문서 상태: 연결된 업무 상태를 그대로 따른다. 업무가 없으면 이관본
export type FinanceStatus = "DRAFT" | "REVIEW" | "DONE" | "IMPORTED";

export const FINANCE_STATUS_LABELS: Record<FinanceStatus, string> = {
  DRAFT: "작성 중",
  REVIEW: "검토 중",
  DONE: "완료",
  IMPORTED: "이관",
};

export const FINANCE_STATUS_ORDER: FinanceStatus[] = ["DRAFT", "REVIEW", "DONE", "IMPORTED"];

export function financeStatus(taskStatus: TaskStatus | null | undefined): FinanceStatus {
  if (!taskStatus) return "IMPORTED";
  return taskStatus === "REVIEW" ? "REVIEW" : taskStatus === "DONE" ? "DONE" : "DRAFT";
}

// 학기: 3~8월은 1학기, 9~2월은 2학기(1·2월은 전년도 2학기). 날짜는 "YYYY-MM-DD"
export function semesterOf(date: string): string {
  const [y, m] = date.split("-").map(Number);
  if (m >= 3 && m <= 8) return `${y}-1`;
  return m >= 9 ? `${y}-2` : `${y - 1}-2`;
}

export const SEMESTER_PATTERN = /^\d{4}-[12]$/;

// 내려받기 이름(기획서): 제목_YYYYMMDD_작성자.xlsx. 파일 이름에 못 쓰는 글자는 뺀다
export function downloadName(title: string, baseDate: string, editor: string): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "").trim() || "문서";
  return `${safe(title)}_${baseDate.replaceAll("-", "")}_${safe(editor)}.xlsx`;
}
