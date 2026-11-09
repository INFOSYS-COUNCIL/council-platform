import { ROLE_ORDER, type MemberRole } from "@/lib/auth/roles";

export type SortableMember = {
  role: MemberRole;
  department_id: string | null;
  name: string;
};

// 부서 순서(부서 없는 회장단은 맨 앞) → Role(회장단→국장→국원) → 이름
export function sortMembers<T extends SortableMember>(members: T[], departmentOrder: Map<string, number>): T[] {
  const order = (m: T) => (m.department_id ? (departmentOrder.get(m.department_id) ?? Infinity) : -Infinity);
  return members.toSorted((a, b) => {
    const byDepartment = order(a) === order(b) ? 0 : order(a) < order(b) ? -1 : 1;
    return byDepartment || ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name, "ko");
  });
}
