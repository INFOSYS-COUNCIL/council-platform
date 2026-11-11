import type { Database } from "@/lib/supabase/database.types";

export type SuggestionStatus = Database["public"]["Enums"]["suggestion_status"];

// 작성자가 보는 상태 문구 (기획서 7장, D-10)
export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  RECEIVED: "접수됨",
  IN_REVIEW: "검토 중",
  RESOLVED: "답변 완료",
  CLOSED: "철회됨", // 작성자가 철회한 건의에만 쓴다
};
// 처리자가 고르는 상태. "마감됨"은 사용 피드백으로 없앴다(철회된 건의만 CLOSED).
export const SUGGESTION_STATUS_ORDER: readonly SuggestionStatus[] = ["RECEIVED", "IN_REVIEW", "RESOLVED"];

// 건의 공개 범위. 작성자 신원과 내부 메모는 어느 쪽이든 공개되지 않는다
export const SUGGESTION_VISIBILITY = {
  COUNCIL: { label: "학생회만", description: "나와 학생회만 볼 수 있습니다." },
  PUBLIC: { label: "전체 공개", description: "로그인한 학생 누구나 제목·내용과 학생회 답변을 볼 수 있습니다. 작성자 이름은 공개되지 않습니다." },
} as const;
export type SuggestionVisibility = keyof typeof SUGGESTION_VISIBILITY;

export const IDENTITY_NOTICE = "작성자 이름과 이메일은 회장·부회장만 볼 수 있습니다.";
