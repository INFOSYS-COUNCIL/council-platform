import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirect";

describe("safeNextPath", () => {
  it("사이트 안의 경로는 그대로 쓴다", () => {
    expect(safeNextPath("/tasks?id=1")).toBe("/tasks?id=1");
  });

  it.each([
    ["값 없음", null],
    ["빈 문자열", ""],
    ["외부 주소", "https://evil.com"],
    ["프로토콜 생략 외부 주소", "//evil.com"],
    ["역슬래시 우회", "/\\evil.com"],
  ])("%s이면 기본 경로로 보낸다", (_label, next) => {
    expect(safeNextPath(next)).toBe("/me");
  });
});
