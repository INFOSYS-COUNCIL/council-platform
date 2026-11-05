import { describe, expect, it } from "vitest";
import { formatDate, isOverdue, todayInSeoul } from "./dates";

describe("todayInSeoul", () => {
  it("UTC 저녁이면 한국은 이미 다음 날이다", () => {
    expect(todayInSeoul(new Date("2026-11-11T16:00:00Z"))).toBe("2026-11-12");
  });
});

describe("formatDate", () => {
  it("올해 날짜는 월·일·요일로 보여 준다", () => {
    expect(formatDate("2026-11-12", "2026-11-05")).toBe("11월 12일 (목)");
  });

  it("다른 해의 날짜는 연도를 붙인다", () => {
    expect(formatDate("2027-01-07", "2026-11-05")).toBe("2027년 1월 7일 (목)");
  });

  it("값이 없으면 빈 문자열", () => {
    expect(formatDate(null)).toBe("");
  });
});

describe("isOverdue", () => {
  it("마감일이 지났고 완료되지 않았으면 기한 초과", () => {
    expect(isOverdue("2026-11-04", false, "2026-11-05")).toBe(true);
  });

  it("마감일 당일은 기한 초과가 아니다", () => {
    expect(isOverdue("2026-11-05", false, "2026-11-05")).toBe(false);
  });

  it("완료했거나 마감일이 없으면 기한 초과가 아니다", () => {
    expect(isOverdue("2026-11-04", true, "2026-11-05")).toBe(false);
    expect(isOverdue(null, false, "2026-11-05")).toBe(false);
  });
});
