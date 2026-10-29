import { describe, expect, it } from "vitest";
import { homePathFor } from "./home";

describe("homePathFor", () => {
  it("학생회 구성원은 대시보드로 보낸다", () => {
    expect(homePathFor(true)).toBe("/dashboard");
  });

  it("소속이 없는 일반 학생은 내 계정 화면으로 보낸다", () => {
    expect(homePathFor(false)).toBe("/me");
  });
});
