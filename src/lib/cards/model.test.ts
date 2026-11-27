import { describe, expect, it } from "vitest";
import { defaultLayouts, LAYOUT_PRESETS, moveLayer, newSlide, normalizeElement, presetLayout, slideElements, smartSnap, snap, textTop, wrapText } from "./model";

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

describe("smartSnap", () => {
  const frame = { width: 1000, height: 1000 };
  it("가운데에 가까우면 붙이고 기준선을 알려 준다", () => {
    const r = smartSnap({ x: 397, y: 10, w: 200, h: 100 }, [], frame, 6);
    expect(r.dx).toBe(3); // 가운데 497 → 500
    expect(r.guideX).toBe(500);
  });
  it("다른 요소의 가장자리에 맞추고, 멀면 그대로 둔다", () => {
    const r = smartSnap({ x: 120, y: 294, w: 50, h: 50 }, [{ x: 0, y: 300, w: 118, h: 10 }], frame, 6);
    expect(r.dx).toBe(-2); // 왼쪽 120 → 다른 요소 오른쪽 118
    expect(r.dy).toBe(6); // 위 294 → 다른 요소 위 300
    expect(smartSnap({ x: 200, y: 200, w: 10, h: 10 }, [], frame, 6)).toEqual({ dx: 0, dy: 0, guideX: null, guideY: null });
  });
  it("크기 바꾸기는 오른쪽·아래 모서리만 맞춘다", () => {
    const r = smartSnap({ x: 0, y: 0, w: 497, h: 10 }, [], frame, 6, true);
    expect(r.dx).toBe(3);
  });
});

describe("붙여 넣은 요소", () => {
  it("장 모양에 없는 페이지 요소도 그린다", () => {
    const [cover] = defaultLayouts();
    const slide = newSlide(cover);
    const pasted = { ...slide.elements[0], id: "pasted", label: "제목 복사" };
    const els = slideElements({ ...slide, elements: [...slide.elements, pasted] }, [cover]);
    expect(els.at(-1)!.id).toBe("pasted");
    expect(els).toHaveLength(cover.elements.length + 1);
  });
});
