import { describe, expect, it } from "vitest";
import { parseBulkInput, type BulkInputOptions } from "./bulk-input";

const options: BulkInputOptions = {
  departments: [{ id: "dept-1", name: "기획국" }],
  positions: [{ id: "pos-1", name: "기획 담당" }],
  director: null,
};

describe("parseBulkInput", () => {
  it("빈 줄을 무시하고 공백을 정리하며 원래 행 번호를 유지한다", () => {
    const [row] = parseBulkInput("\r\n  person@example.test \t 0123456789 \t 기획국 \t 국원 \t 기획 담당 ", options);
    expect(row).toMatchObject({
      rowNo: 2,
      registration: {
        email: "person@example.test",
        student_no: "0123456789",
        department_id: "dept-1",
        role: "MEMBER",
        position_id: "pos-1",
      },
    });
  });

  it.each([
    ["없는국\t국원", "부서 이름"],
    ["기획국\t위원", "역할"],
    ["기획국\t국원\t없는 직책", "직책 이름"],
  ])("잘못된 부서·역할·직책을 표시한다 (%s)", (cells, message) => {
    const [row] = parseBulkInput(`person@example.test\t0123456789\t${cells}`, options);
    expect(row).toMatchObject({ rowNo: 1, error: expect.stringContaining(message) });
  });

  it("부서와 직책이 없는 회장단을 처리한다", () => {
    const [row] = parseBulkInput("person@example.test\t0123456789\t\t회장단", options);
    expect(row).toMatchObject({
      registration: { role: "EXECUTIVE", department_id: null, position_id: null },
    });
  });

  it("국장 입력의 부서와 역할을 자기 국 국원으로 고정한다", () => {
    const director = { ...options, director: { departmentId: "dept-1" } };
    const [valid, invalid] = parseBulkInput(
      "person@example.test\t0123456789\t기획 담당\nperson@example.test\t0123456789\t다른 국\t국장",
      director,
    );
    expect(valid).toMatchObject({
      registration: { role: "MEMBER", department_id: "dept-1", position_id: "pos-1" },
    });
    expect(invalid).toMatchObject({ error: expect.stringContaining("열 순서") });
  });
});
