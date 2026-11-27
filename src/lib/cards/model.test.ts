import { describe, expect, it } from "vitest";
import { defaultLayouts, LAYOUT_PRESETS, moveLayer, newSlide, normalizeElement, presetLayout, slideElements, snap, textTop, wrapText } from "./model";

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

describe("레이어·격자·세로 정렬", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  it("맨 앞·앞으로·뒤로·맨 뒤로", () => {
    expect(moveLayer(items, "a", "front").map((e) => e.id)).toEqual(["b", "c", "a"]);
    expect(moveLayer(items, "a", "forward").map((e) => e.id)).toEqual(["b", "a", "c"]);
    expect(moveLayer(items, "c", "backward").map((e) => e.id)).toEqual(["a", "c", "b"]);
    expect(moveLayer(items, "c", "back").map((e) => e.id)).toEqual(["c", "a", "b"]);
    expect(moveLayer(items, "c", "front")).toBe(items);
  });
  it("격자 칸에 맞춘다(0이면 끄기)", () => {
    expect(snap(37, 20)).toBe(40);
    expect(snap(29, 20)).toBe(20);
    expect(snap(37.4, 0)).toBe(37);
  });
  it("글 상자 높이 안에서 세로 정렬한다", () => {
    const el = { y: 100, h: 300, fontSize: 40, valign: "middle" as const };
    const lineH = 40 * 1.35;
    expect(textTop(el, 2)).toBeCloseTo(100 + (300 - 2 * lineH) / 2);
    expect(textTop({ ...el, valign: "bottom" }, 2)).toBeCloseTo(100 + 300 - 2 * lineH);
    expect(textTop({ ...el, h: 0 }, 2)).toBe(100);
  });
});

describe("예전 데이터와 기본 템플릿", () => {
  it("예전 그림자 요소는 같은 모양이 되게 세부값을 채운다", () => {
    const old = normalizeElement({ id: "x", kind: "text", fontSize: 120, shadow: true });
    expect(old.shadowBlur).toBe(30);
    expect(old.shadowOpacity).toBe(0.25);
    expect(old.valign).toBe("top");
  });
  it("종류별 기본 템플릿을 모두 만든다(달력은 7×5칸)", () => {
    expect(defaultLayouts().map((l) => l.name)).toEqual([...LAYOUT_PRESETS]);
    const cal = presetLayout("달력");
    expect(cal.elements.filter((e) => e.editable && e.label.includes("주"))).toHaveLength(35);
  });
  it("페이지에서 바꾼 레이어 순서를 따른다", () => {
    const [cover] = defaultLayouts();
    const slide = newSlide(cover);
    const ids = cover.elements.map((e) => e.id);
    const order = [...ids].reverse();
    expect(slideElements({ ...slide, order }, [cover]).map((e) => e.id)).toEqual(order);
  });
});
