import { describe, expect, it } from "vitest";
import { sectionTarget } from "./section-pager";

const sections = [{ offsetTop: 0, offsetHeight: 800 }, { offsetTop: 800, offsetHeight: 1600 }, { offsetTop: 2400, offsetHeight: 800 }];

describe("구역 이동", () => {
  it("다음 구역과 긴 이전 구역의 마지막 화면으로 이동한다", () => {
    expect(sectionTarget(sections, 0, 800, 1)).toBe(800);
    expect(sectionTarget(sections, 2400, 800, -1)).toBe(1600);
  });
  it("긴 구역에서 휠은 내용 스크롤에 맡기고 화살표는 화면만큼 이동한다", () => {
    expect(sectionTarget(sections, 800, 800, 1)).toBeNull();
    expect(sectionTarget(sections, 800, 800, 1, true)).toBe(1480);
    expect(sectionTarget(sections, 1480, 800, 1, true)).toBe(1600);
    expect(sectionTarget(sections, 1600, 800, -1, true)).toBe(920);
    expect(sectionTarget(sections, 920, 800, -1, true)).toBe(800);
  });
  it("긴 구역 중간을 다음 구역으로 잘못 판정하지 않는다", () => {
    expect(sectionTarget(sections, 1500, 800, 1)).toBeNull();
  });
  it("한 화면에서 조금 넘친 여백은 바로 다음 구역으로 넘긴다", () => {
    expect(sectionTarget([{ offsetTop: 0, offsetHeight: 825 }, { offsetTop: 825, offsetHeight: 800 }], 0, 800, 1, true)).toBe(825);
    expect(sectionTarget([{ offsetTop: 0, offsetHeight: 825 }, { offsetTop: 825, offsetHeight: 800 }], 825, 800, -1, true)).toBe(0);
  });
  it("첫 구역 앞이나 마지막 구역 뒤로 이동하지 않는다", () => {
    expect(sectionTarget(sections, 0, 800, -1)).toBeNull();
    expect(sectionTarget(sections, 20, 800, -1, true)).toBe(0);
    expect(sectionTarget(sections, 2400, 800, 1)).toBeNull();
    expect(sectionTarget([], 0, 800, 1)).toBeNull();
  });
});
