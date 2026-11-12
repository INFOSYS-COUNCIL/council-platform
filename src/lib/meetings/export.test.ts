import { describe, expect, it } from "vitest";
import { markdownFileName } from "./export";

describe("markdownFileName", () => {
  it("한국 시간 일시와 제목으로 이름을 만든다", () => {
    expect(markdownFileName("2026-11-12T05:30:00Z", "정기 회의")).toBe("2026-11-12 1430-정기 회의.md");
  });
  it("파일 이름에 못 쓰는 문자는 바꾼다", () => {
    expect(markdownFileName("2026-11-12T05:30:00Z", 'a/b:c?')).toBe("2026-11-12 1430-a_b_c_.md");
  });
});
