import type { ActiveMembership } from "@/lib/auth/session";

type Assignment = { assigned_department_id: string | null; assigned_user_id: string | null };

// 받은 건의 처리 화면에 보일 건의: 회장단은 전부, 국장은 자기 국 배정 건, 그 밖에는 나에게 배정된 건.
// RLS는 전체 공개 건의를 누구에게나 돌려주므로 이 화면에서는 처리 담당 여부로 다시 거른다.
export function isSuggestionHandler(m: ActiveMembership, userId: string, s: Assignment): boolean {
  if (m.role === "EXECUTIVE") return true;
  if (s.assigned_user_id === userId) return true;
  return m.role === "DIRECTOR" && m.departmentId !== null && s.assigned_department_id === m.departmentId;
}

// 같은 규칙을 PostgREST or 필터로. 회장단이면 null(거르지 않음)
export function handlerFilter(m: ActiveMembership, userId: string): string | null {
  if (m.role === "EXECUTIVE") return null;
  const mine = `assigned_user_id.eq.${userId}`;
  return m.role === "DIRECTOR" && m.departmentId ? `${mine},assigned_department_id.eq.${m.departmentId}` : mine;
}
