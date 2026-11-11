import { describe, expect, it } from "vitest";
import { buildOrgChart } from "./org-chart";

const org = {
  departments: [
    { id: "fin", name: "재무국" },
    { id: "pr", name: "홍보국" },
  ],
  members: [
    { userId: "e", name: "회장", role: "EXECUTIVE" as const, departmentId: null, departmentName: null },
    { userId: "d1", name: "재무국장", role: "DIRECTOR" as const, departmentId: "fin", departmentName: "재무국" },
    { userId: "m1", name: "재무국원", role: "MEMBER" as const, departmentId: "fin", departmentName: "재무국" },
    { userId: "d2", name: "홍보국장", role: "DIRECTOR" as const, departmentId: "pr", departmentName: "홍보국" },
  ],
};
const tasks = [
  { id: "t1", assignee_id: "m1", department_id: "fin" },
  { id: "t2", assignee_id: null, department_id: "fin" },
  { id: "t3", assignee_id: "e", department_id: "pr" },
];

describe("buildOrgChart", () => {
  it("회장단은 회장단 묶음과 모든 국을 보고, 사람마다 맡은 업무가 붙는다", () => {
    const groups = buildOrgChart(org, tasks, { role: "EXECUTIVE", departmentId: null });
    expect(groups.map((g) => g.title)).toEqual(["회장단", "재무국", "홍보국"]);
    expect(groups[0].people.map((p) => [p.name, p.tasks.map((t) => t.id)])).toEqual([["회장", ["t3"]]]);
    expect(groups[1].people.map((p) => p.name)).toEqual(["재무국장", "재무국원"]);
    expect(groups[1].people[1].tasks.map((t) => t.id)).toEqual(["t1"]);
    expect(groups[1].unassigned.map((t) => t.id)).toEqual(["t2"]);
  });

  it("국장은 자기 국만 본다", () => {
    const groups = buildOrgChart(org, tasks, { role: "DIRECTOR", departmentId: "pr" });
    expect(groups.map((g) => g.title)).toEqual(["홍보국"]);
    expect(groups[0].people.map((p) => p.name)).toEqual(["홍보국장"]);
  });
});
