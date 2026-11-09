import type { MemberRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";

export type MeetingStatus = Database["public"]["Enums"]["meeting_status"];

export const MEETING_STATUS_ORDER: readonly MeetingStatus[] = ["DRAFT", "CONFIRMED", "ARCHIVED"];
// 화면 이름: 상태가 무엇을 뜻하는지 바로 알 수 있게 쓴다
export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  DRAFT: "편집 중",
  CONFIRMED: "최종본",
  ARCHIVED: "보관됨",
};

export const MEETING_STATUS_HELP: Record<MeetingStatus, string> = {
  DRAFT: "편집자들이 본문을 함께 고칠 수 있습니다.",
  CONFIRMED: "내용이 최종 확정되어 잠겼습니다. 아무도 본문을 고칠 수 없습니다.",
  ARCHIVED: "목록에서 숨겨진 지난 회의록입니다. 읽기만 할 수 있습니다.",
};

// 열람 범위 Preset (기획서 6.3절). 하나만 고르며 DB에는 범용 ACL로 저장한다.
export const MEETING_SCOPES = ["ALL_COUNCIL", "DEPARTMENTS", "DIRECTORS", "EXECUTIVES"] as const;
export type MeetingScope = (typeof MEETING_SCOPES)[number];
export const MEETING_SCOPE_LABELS: Record<MeetingScope, { label: string; description: string }> = {
  ALL_COUNCIL: { label: "학생회 전체", description: "이번 기수 학생회 구성원(국원 이상) 모두" },
  DEPARTMENTS: { label: "선택한 국만", description: "선택한 국의 구성원(국장 포함)" },
  DIRECTORS: { label: "국장 이상", description: "모든 국장과 회장단" },
  EXECUTIVES: { label: "회장단만", description: "회장단만" },
};

// 회의록을 만들 수 있는 Role (6.2절). 실제 검사는 create_meeting 함수가 한다.
export const MEETING_CREATE_ROLES: readonly MemberRole[] = ["EXECUTIVE", "DIRECTOR"];

// Yjs 문서 안에서 BlockNote 본문이 들어가는 XmlFragment 이름. 편집기와 서버 변환이 같은 값을 쓴다.
export const MEETING_FRAGMENT = "document-store";

// Postgres bytea ↔ Uint8Array. PostgREST는 bytea를 "\x<16진수>" 문자열로 주고받는다.
export function toBytea(bytes: Uint8Array): string {
  let hex = "\\x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

export function fromBytea(value: string): Uint8Array {
  if (!/^\\x([0-9a-f]{2})*$/i.test(value)) throw new Error("bytea 형식이 아닙니다.");
  const bytes = new Uint8Array((value.length - 2) / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(2 + i * 2, 4 + i * 2), 16);
  return bytes;
}
