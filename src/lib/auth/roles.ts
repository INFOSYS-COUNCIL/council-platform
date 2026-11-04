import type { Database } from "@/lib/supabase/database.types";

export type MemberRole = Database["public"]["Enums"]["member_role"];

// 화면에 보이는 Role 이름. 순서는 목록 정렬(회장단 → 국장 → 국원)에도 쓴다.
export const ROLE_LABELS: Record<MemberRole, string> = {
  EXECUTIVE: "회장단",
  DIRECTOR: "국장",
  MEMBER: "국원",
};

export const ROLE_ORDER: readonly MemberRole[] = [
  "EXECUTIVE",
  "DIRECTOR",
  "MEMBER",
];
