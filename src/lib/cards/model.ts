// 카드뉴스 배치 모델. 틀(Template)은 장 모양(Layout) 여러 개를, 카드뉴스는 장(Slide) 여러 개를 가진다.
// 장은 고른 장 모양의 요소를 복사해 글·크기·위치를 고친 것이다. 좌표·크기는 모두 실제 이미지 픽셀 기준.

export type CardElement = {
  id: string;
  kind: "text" | "box";
  label: string; // 편집 패널에 보이는 이름(예: 제목, 날짜)
  x: number;
  y: number;
  w: number;
  h: number; // 상자 높이. 글 요소는 쓰지 않는다(줄 수로 정해진다)
  text: string;
  fontSize: number;
  color: string; // #rrggbb
  align: "left" | "center" | "right";
  bold: boolean;
  shadow: boolean;
  opacity: number; // 0~1(상자 채우기·글자)
  radius: number; // 상자 모서리
  editable: boolean; // false면 틀에 고정(카드뉴스에서 고치지 못함)
};

export type CardLayout = { id: string; name: string; elements: CardElement[] };
export type CardSlide = { id: string; layoutId: string; elements: CardElement[] };

export type CardTemplate = {
  id: string;
  name: string;
  width: number;
  height: number;
  background_color: string;
  background_path: string | null;
  font_path: string | null;
  layouts: CardLayout[];
};

export const CARD_SIZES = [
  { label: "인스타 세로 (1080×1350)", width: 1080, height: 1350 },
  { label: "정사각 (1080×1080)", width: 1080, height: 1080 },
  { label: "스토리 (1080×1920)", width: 1080, height: 1920 },
] as const;

export const LINE_HEIGHT = 1.35;

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

export function textElement(over: Partial<CardElement>): CardElement {
  return {
    id: newId(),
    kind: "text",
    label: "글",
    x: 80,
    y: 80,
    w: 920,
    h: 0,
    text: "글을 입력하세요",
    fontSize: 48,
    color: "#ffffff",
    align: "left",
    bold: false,
    shadow: false,
    opacity: 1,
    radius: 0,
    editable: true,
    ...over,
  };
}

export function boxElement(over: Partial<CardElement>): CardElement {
  return {
    ...textElement({}),
    kind: "box",
    label: "상자",
    text: "",
    w: 920,
    h: 600,
    color: "#ffffff",
    opacity: 0.45,
    radius: 28,
    editable: false,
    ...over,
  };
}

// 보내 준 카드뉴스 예시(표지 / 본문 / 2단 안내)를 본뜬 기본 장 모양. 1080×1350 기준이며 다른 크기는 비율로 옮긴다
export function defaultLayouts(width = 1080, height = 1350, header = "학생회 이름"): CardLayout[] {
  const sx = width / 1080;
  const sy = height / 1350;
  const scale = (e: CardElement): CardElement => ({
    ...e,
    x: Math.round(e.x * sx),
    y: Math.round(e.y * sy),
    w: Math.round(e.w * sx),
    h: Math.round(e.h * sy),
    fontSize: Math.round(e.fontSize * Math.min(sx, sy)),
  });
  const headerEl = () => textElement({ label: "상단 문구", text: header, x: 140, y: 40, w: 800, fontSize: 26, align: "center", editable: false, opacity: 0.85 });
  return [
    {
      id: newId(),
      name: "표지",
      elements: [
        headerEl(),
        textElement({ label: "제목", text: "사물함\n정리 안내", x: 80, y: 330, w: 920, fontSize: 120, bold: true, shadow: true }),
        textElement({ label: "날짜", text: "기간: 2026.8.24(월) ~ 2026.8.28(금)", x: 84, y: 680, w: 920, fontSize: 36 }),
      ].map(scale),
    },
    {
      id: newId(),
      name: "본문",
      elements: [
        textElement({ label: "제목", text: "사물함 정리 안내", x: 80, y: 90, w: 920, fontSize: 96, bold: true, shadow: true, align: "center" }),
        boxElement({ label: "내용 상자", x: 60, y: 300, w: 960, h: 980 }),
        textElement({
          label: "내용",
          text: "● 정리 기간 | 8/24(월) ~ 8/28(금)\n\n● 정리 안내 |\n- 사물함을 사용하시던 학우분들께서는 기간 내에 물품을 가져가 주세요.",
          x: 130,
          y: 380,
          w: 820,
          fontSize: 40,
          color: "#3d4a66",
        }),
      ].map(scale),
    },
    {
      id: newId(),
      name: "2단 안내",
      elements: [
        textElement({ label: "제목", text: "단톡방 안내", x: 80, y: 90, w: 920, fontSize: 88, bold: true, shadow: true, align: "center" }),
        boxElement({ label: "왼쪽 상자", x: 70, y: 250, w: 450, h: 300, opacity: 0.4, radius: 20 }),
        boxElement({ label: "오른쪽 상자", x: 560, y: 250, w: 450, h: 300, opacity: 0.4, radius: 20 }),
        textElement({ label: "왼쪽 글", text: "● 전학년 공지방\n- 학과 전체 공지", x: 100, y: 285, w: 390, fontSize: 34, color: "#3d4a66" }),
        textElement({ label: "오른쪽 글", text: "● 학년별 공지방\n- 각 학년 공지", x: 590, y: 285, w: 390, fontSize: 34, color: "#3d4a66" }),
        textElement({ label: "아래 글", text: "● 문의 | 오픈채팅방", x: 100, y: 640, w: 880, fontSize: 38, color: "#3d4a66" }),
      ].map(scale),
    },
  ];
}

// 글을 주어진 폭에 맞게 줄로 나눈다. 미리보기와 내려받기 그림이 같은 함수를 써서 줄바꿈이 똑같다.
// 띄어쓰기 단위로 넘기고(한국어 낱말이 중간에서 끊기지 않게), 한 낱말이 폭보다 길면 글자 단위로 끊는다.
export function wrapText(measure: (s: string) => number, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/(?<= )/)) {
      const next = line + word;
      if (measure(next.trimEnd()) <= maxWidth || line === "") {
        if (measure(word.trimEnd()) > maxWidth && line === "") {
          // 낱말 하나가 폭보다 길다: 글자 단위로 끊는다
          let piece = "";
          for (const ch of word) {
            if (piece && measure(piece + ch) > maxWidth) {
              lines.push(piece);
              piece = "";
            }
            piece += ch;
          }
          line = piece;
        } else {
          line = next;
        }
      } else {
        lines.push(line.trimEnd());
        line = word;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}

export const fontCss = (el: Pick<CardElement, "bold" | "fontSize">, family: string) =>
  `${el.bold ? 700 : 400} ${el.fontSize}px ${family ? `"${family}", ` : ""}Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;

// 저장된 JSON을 안전하게 읽는다(모양이 다르면 버린다)
export function parseLayouts(value: unknown): CardLayout[] {
  if (!Array.isArray(value)) return [];
  return value.filter((l): l is CardLayout => !!l && typeof l === "object" && Array.isArray((l as CardLayout).elements));
}

export function parseSlides(value: unknown): CardSlide[] {
  if (!Array.isArray(value)) return [];
  return value.filter((s): s is CardSlide => !!s && typeof s === "object" && Array.isArray((s as CardSlide).elements));
}

// 장에 그릴 요소: 틀에 고정된 요소는 지금 틀에서(틀을 고치면 이미 만든 카드뉴스에도 반영), 고칠 수 있는 칸은 장에 저장된 값으로.
// 순서는 틀의 장 모양을 따른다. 틀에서 장 모양이 지워졌으면 장에 저장된 요소를 그대로 쓴다.
export function slideElements(slide: CardSlide, layouts: CardLayout[]): CardElement[] {
  const layout = layouts.find((l) => l.id === slide.layoutId);
  if (!layout) return slide.elements;
  return layout.elements.map((e) => (e.editable ? (slide.elements.find((s) => s.id === e.id) ?? e) : e));
}

// 새 장: 장 모양의 고칠 수 있는 칸만 복사해 둔다
export function newSlide(layout: CardLayout): CardSlide {
  return { id: newId(), layoutId: layout.id, elements: structuredClone(layout.elements.filter((e) => e.editable)) };
}
