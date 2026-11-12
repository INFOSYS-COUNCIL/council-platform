// 페이지 공개 범위 (2차 QA). 회장단과 만든 사람은 범위와 상관없이 본다.
export const PAGE_SCOPES = ["ALL_COUNCIL", "DEPARTMENTS", "USERS"] as const;
export type PageScope = (typeof PAGE_SCOPES)[number];

export const PAGE_SCOPE_LABELS: Record<PageScope, { label: string; description: string }> = {
  ALL_COUNCIL: { label: "전체 공개", description: "학생회 구성원 모두가 보고 함께 고칩니다." },
  DEPARTMENTS: { label: "담당국끼리 공개", description: "고른 국의 구성원만 보고 함께 고칩니다." },
  USERS: { label: "지정 공개", description: "고른 사람만 보고 함께 고칩니다." },
};

// "예산, 회계" → ["예산", "회계"]. DB가 다시 정리한다(빈 것·중복 제거, 20자, 10개)
export function parseTags(value: string): string[] {
  return [...new Set(value.split(",").map((t) => t.trim()).filter(Boolean))].slice(0, 10);
}
