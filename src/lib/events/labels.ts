import type { MemberRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type EventStatus = Enums["event_status"];
export type EventVisibility = Enums["event_visibility"];

// D-15: 한 단계씩 앞뒤로만 바꾼다. 실제 검사는 change_event_status 함수가 한다.
export const EVENT_STATUS_ORDER: readonly EventStatus[] = ["PLANNING", "ACTIVE", "COMPLETED", "ARCHIVED"];
export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  PLANNING: "준비 중",
  ACTIVE: "진행 중",
  COMPLETED: "끝난 행사",
  ARCHIVED: "보관됨",
};

export const EVENT_VISIBILITY_LABELS: Record<EventVisibility, { label: string; description: string }> = {
  ALL_COUNCIL: { label: "학생회 전체", description: "이번 기수 학생회 구성원 모두가 볼 수 있습니다." },
  RESTRICTED: {
    label: "지정한 사람만",
    description: "회장단, 담당 국, 만든 사람·관리자, 추가한 열람 대상만 볼 수 있습니다.",
  },
};

export const EVENT_CREATE_ROLES: readonly MemberRole[] = ["EXECUTIVE", "DIRECTOR"];

// 업로드 허용 형식 (기획서 0.2·5.3절). Storage Bucket의 allowed_mime_types와 같아야 한다.
// 브라우저가 HWP의 형식을 비워 보내는 경우가 있어 확장자로 정해 올린다.
export const UPLOAD_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwp: "application/x-hwp",
  hwpx: "application/vnd.hancom.hwpx",
};
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// 올리기 전에 거를 이유. 통과하면 null. (최종 거부는 Storage 설정이 한다)
export function uploadProblem(file: { name: string; size: number }): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!UPLOAD_TYPES[ext]) return "PDF, 이미지(PNG·JPG·WEBP), XLSX, DOCX, PPTX, HWP, HWPX만 올릴 수 있습니다.";
  if (file.size > MAX_UPLOAD_BYTES) return "10MB를 넘는 파일은 외부 링크(Google Drive 등)로 등록해 주세요.";
  if (file.size === 0) return "빈 파일은 올릴 수 없습니다.";
  return null;
}

// Storage 경로 "<기수>/<행사>/<임의 id>.<확장자>". 원래 파일 이름은 경로에 넣지 않는다(한글·공백 문제).
export function uploadPath(termId: string, eventId: string, fileName: string, id: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return `${termId}/${eventId}/${id}.${ext}`;
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)}KB` : `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
