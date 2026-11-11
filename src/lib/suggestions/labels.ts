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

export const IDENTITY_NOTICE = "작성자 이름과 이메일은 회장·부회장만 볼 수 있습니다.";
