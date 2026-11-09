import { describe, expect, it } from "vitest";
import { sortMembers } from "./sort";

describe("sortMembers", () => {
  const order = new Map([["finance", 1], ["pr", 0]]);

  it("부서 순서 → Role → 이름 순, 부서 없는 회장단이 맨 앞", () => {
    const sorted = sortMembers(
      [
        { name: "다", role: "MEMBER", department_id: "finance" },
        { name: "나", role: "MEMBER", department_id: "pr" },
        { name: "가", role: "DIRECTOR", department_id: "pr" },
        { name: "하", role: "EXECUTIVE", department_id: null },
        { name: "라", role: "DIRECTOR", department_id: "finance" },
        { name: "가", role: "MEMBER", department_id: "pr" },
      ],
      order,
    );
    expect(sorted.map((m) => `${m.department_id ?? "-"}/${m.role}/${m.name}`)).toEqual([
      "-/EXECUTIVE/하",
      "pr/DIRECTOR/가",
      "pr/MEMBER/가",
      "pr/MEMBER/나",
      "finance/DIRECTOR/라",
      "finance/MEMBER/다",
    ]);
  });

  it("목록에 없는 부서는 뒤로", () => {
    const sorted = sortMembers(
      [
        { name: "가", role: "MEMBER", department_id: "unknown" },
        { name: "나", role: "MEMBER", department_id: "pr" },
      ],
      order,
    );
    expect(sorted.map((m) => m.name)).toEqual(["나", "가"]);
  });
});
