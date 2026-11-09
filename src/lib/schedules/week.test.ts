import { describe, expect, it } from "vitest";
import { addMonths, groupByDay, monthGrid, mondayOf, timeLabel, weekDays } from "./week";

describe("mondayOf / weekDays", () => {
  it("일요일은 그 주의 월요일(6일 전)로, 월요일은 그대로", () => {
    expect(mondayOf("2026-11-15")).toBe("2026-11-09"); // 일
    expect(mondayOf("2026-11-09")).toBe("2026-11-09"); // 월
    expect(mondayOf("2026-01-01")).toBe("2025-12-29"); // 해 넘김
  });

  it("월~일 7일", () => {
    expect(weekDays("2026-11-09")).toEqual([
      "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15",
    ]);
  });
});

describe("groupByDay", () => {
  const allDay = { is_all_day: true, start_date: "2026-11-10", end_date: "2026-11-11", starts_at: null, ends_at: null };
  // 한국 시간 11/11 23:00 ~ 11/12 01:00 (UTC로는 같은 날 14:00~16:00)
  const night = { is_all_day: false, start_date: null, end_date: null, starts_at: "2026-11-11T14:00:00Z", ends_at: "2026-11-11T16:00:00Z" };

  it("여러 날에 걸친 일정은 걸친 날마다 나오고, 시간 일정은 한국 날짜로 나눈다", () => {
    const days = groupByDay([night, allDay], weekDays("2026-11-09"));
    expect(days.get("2026-11-09")).toEqual([]);
    expect(days.get("2026-11-10")).toEqual([allDay]);
    expect(days.get("2026-11-11")).toEqual([allDay, night]); // 종일 먼저
    expect(days.get("2026-11-12")).toEqual([night]);
  });

  it("시간 표시는 한국 시각", () => {
    expect(timeLabel(night)).toBe("23:00–01:00");
    expect(timeLabel(allDay)).toBe("종일");
  });
});

describe("monthGrid / addMonths", () => {
  it("그 달 1일이 든 주의 월요일부터 42일", () => {
    const grid = monthGrid("2026-11"); // 11/1은 일요일
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid[41]).toBe("2026-12-06");
  });

  it("해를 넘겨 달을 옮긴다", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
  });
});
