import { describe, expect, it } from "vitest";
import { parseTags } from "./labels";

describe("parseTags", () => {
  it("쉼표로 나누고 빈 것·중복을 뺀다", () => {
    expect(parseTags(" 예산, 회계,,예산 ")).toEqual(["예산", "회계"]);
  });
});
