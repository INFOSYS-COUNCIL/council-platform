import type { MemberRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type TaskStatus = Enums["task_status"];
export type TaskPriority = Enums["task_priority"];
export type VisibilityMode = Enums["visibility_mode"];
export type AclSubjectType = Enums["acl_subject_type"];
export type AclRoleGroup = Enums["acl_role_group"];

// 화면에 보이는 이름. 순서 배열은 선택 목록과 정렬에 쓴다 (기획서 4.1절, D-1·D-2).
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "할 일",
  IN_PROGRESS: "진행 중",
  REVIEW: "확인 요청",
  DONE: "완료",
};
export const TASK_STATUS_ORDER: readonly TaskStatus[] = [
  "TODO",
  "IN_PROGRESS",
  "REVIEW",
  "DONE",
];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  HIGH: "높음",
  NORMAL: "보통",
  LOW: "낮음",
};
export const TASK_PRIORITY_ORDER: readonly TaskPriority[] = [
  "HIGH",
  "NORMAL",
  "LOW",
];

// 공개 모드 설명은 생성·상세 화면에 그대로 보여 준다 (기획서 4.2절)
export const VISIBILITY_LABELS: Record<
  VisibilityMode,
  { label: string; description: string }
> = {
  DEFAULT: {
    label: "기본 공개",
    description: "회장단, 담당 국 구성원, 생성자, 담당자, 추가한 열람 대상이 볼 수 있습니다.",
  },
  RESTRICTED: {
    label: "제한 공개",
    description:
      "회장단, 생성자, 담당자, 관리 책임자와 직접 추가한 열람 대상만 볼 수 있습니다. 담당 국의 다른 구성원은 자동으로 볼 수 없습니다.",
  },
};

export const ACL_ROLE_GROUP_LABELS: Record<AclRoleGroup, string> = {
  ALL_COUNCIL: "학생회 전체",
  DIRECTORS: "국장 이상",
  EXECUTIVES: "회장단",
};

// 업무를 만들 수 있는 Role (기획서 4.6절). 실제 검사는 create_task 함수가 한다.
export const TASK_CREATE_ROLES: readonly MemberRole[] = ["EXECUTIVE", "DIRECTOR"];
