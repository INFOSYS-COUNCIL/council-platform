import type { MemberRole } from "@/lib/auth/roles";
import type { TermOrgOptions } from "@/lib/org/options";

// 관리 > 조직도·업무 현황: 사람을 회장단 / 국(국장 → 국원)으로 묶고, 각자 맡은 업무를 붙인다.
// 회장단은 회장단·모든 국을, 국장은 자기 국만 본다. 업무 자체는 RLS가 볼 수 있는 것만 돌려준다.

export type OrgTask = { id: string; assignee_id: string | null; department_id: string };
export type OrgPerson<T> = { userId: string; name: string; role: MemberRole; tasks: T[] };
export type OrgGroup<T> = { key: string; title: string; people: OrgPerson<T>[]; unassigned: T[] };

export function buildOrgChart<T extends OrgTask>(
  org: TermOrgOptions,
  tasks: T[],
  viewer: { role: MemberRole; departmentId: string | null },
): OrgGroup<T>[] {
  const person = (m: TermOrgOptions["members"][number]): OrgPerson<T> => ({
    userId: m.userId,
    name: m.name,
    role: m.role,
    tasks: tasks.filter((t) => t.assignee_id === m.userId),
  });

  const groups: OrgGroup<T>[] = [];
  if (viewer.role === "EXECUTIVE") {
    groups.push({
      key: "executives",
      title: "회장단",
      people: org.members.filter((m) => m.role === "EXECUTIVE").map(person),
      unassigned: [],
    });
  }
  const departments =
    viewer.role === "EXECUTIVE" ? org.departments : org.departments.filter((d) => d.id === viewer.departmentId);
  for (const d of departments) {
    groups.push({
      key: d.id,
      title: d.name,
      // org.members는 이미 국장 → 국원 → 이름 순이다. 회장단은 위 묶음에만 둔다
      people: org.members.filter((m) => m.departmentId === d.id && m.role !== "EXECUTIVE").map(person),
      unassigned: tasks.filter((t) => t.department_id === d.id && t.assignee_id === null),
    });
  }
  return groups;
}
