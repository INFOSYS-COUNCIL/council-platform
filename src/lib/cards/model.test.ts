import { describe, expect, it } from "vitest";
import { defaultLayouts, newSlide, slideElements, wrapText } from "./model";

// 글자 하나 폭 10으로 잰다
const measure = (s: string) => s.length * 10;

describe("wrapText", () => {
  it("띄어쓰기 단위로 넘긴다", () => {
    expect(wrapText(measure, "가나 다라 마바", 50)).toEqual(["가나 다라", "마바"]);
  });
  it("줄바꿈과 빈 줄을 지킨다", () => {
    expect(wrapText(measure, "가나\n\n다라", 100)).toEqual(["가나", "", "다라"]);
  });
  it("폭보다 긴 낱말은 글자 단위로 끊는다", () => {
    expect(wrapText(measure, "가나다라마바사", 30)).toEqual(["가나다", "라마바", "사"]);
  });
});

describe("defaultLayouts", () => {
  it("다른 크기는 비율로 옮긴다", () => {
    const [cover] = defaultLayouts(540, 675);
    const title = cover.elements.find((e) => e.label === "제목")!;
    expect(title.x).toBe(40);
    expect(title.fontSize).toBe(60);
  });
});

describe("slideElements", () => {
  it("고정 요소는 지금 틀에서, 고칠 칸은 장에서 가져온다", () => {
    const [cover] = defaultLayouts();
    const slide = newSlide(cover);
    const title = slide.elements.find((e) => e.label === "제목")!;
    title.text = "바뀐 제목";
    const header = cover.elements.find((e) => !e.editable)!;
    header.text = "틀에서 바꾼 상단 문구";
    const els = slideElements(slide, [cover]);
    expect(els.find((e) => e.label === "제목")!.text).toBe("바뀐 제목");
    expect(els.find((e) => e.label === "상단 문구")!.text).toBe("틀에서 바꾼 상단 문구");
    expect(els.map((e) => e.label)).toEqual(cover.elements.map((e) => e.label));
  });
});
