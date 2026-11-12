import { describe, expect, it, vi } from "vitest";
import { groupOrgChart } from "./public-chart";

vi.mock("server-only", () => ({}));

describe("groupOrgChart", () => {
  it("회장단을 따로 모으고 국은 나온 순서대로 묶는다", () => {
    const row = (name: string, role: "EXECUTIVE" | "DIRECTOR" | "MEMBER", dept: string | null, pos: string | null = null) => ({
      name, role, department_name: dept, position_name: pos,
    });
    const chart = groupOrgChart([
      row("회장", "EXECUTIVE", null, "회장"),
      row("가", "DIRECTOR", "사무국"),
      row("나", "MEMBER", "사무국"),
      row("다", "DIRECTOR", "재무국"),
    ]);
    expect(chart.executives.map((p) => p.position)).toEqual(["회장"]);
    expect(chart.departments.map((g) => [g.title, g.people.map((p) => p.name)])).toEqual([
      ["사무국", ["가", "나"]],
      ["재무국", ["다"]],
    ]);
  });
});
