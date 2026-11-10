import type { Database } from "@/lib/supabase/database.types";

export type SuggestionStatus = Database["public"]["Enums"]["suggestion_status"];

// 작성자가 보는 상태 문구 (기획서 7장, D-10)
export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  RECEIVED: "접수됨",
  IN_REVIEW: "검토 중",
  RESOLVED: "답변 완료",
  CLOSED: "마감됨",
};
export const SUGGESTION_STATUS_ORDER: readonly SuggestionStatus[] = ["RECEIVED", "IN_REVIEW", "RESOLVED", "CLOSED"];

export const IDENTITY_NOTICE = "작성자 이름과 이메일은 회장·부회장만 볼 수 있습니다.";
