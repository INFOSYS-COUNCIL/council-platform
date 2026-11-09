import { describe, expect, it } from "vitest";
import { plusHour, timeLabelKo } from "./date-time-picker";

describe("timeLabelKo", () => {
  it("24시간 시각을 오전·오후로", () => {
    expect(timeLabelKo("00:30")).toBe("오전 12:30");
    expect(timeLabelKo("09:00")).toBe("오전 9:00");
    expect(timeLabelKo("12:00")).toBe("오후 12:00");
    expect(timeLabelKo("13:30")).toBe("오후 1:30");
  });
});

describe("plusHour", () => {
  it("한 시간 뒤, 자정을 넘기면 그날 23:30", () => {
    expect(plusHour("2026-11-10T10:30")).toBe("2026-11-10T11:30");
    expect(plusHour("2026-11-10T23:00")).toBe("2026-11-10T23:30");
  });
});
