// 카드뉴스 배치 모델. 틀(Template)은 장 모양(Layout) 여러 개를, 카드뉴스는 장(Slide, 화면에서는 "페이지") 여러 개를 가진다.
// 장은 고른 장 모양의 요소를 복사해 글·크기·위치를 고친 것이다. 좌표·크기는 모두 실제 이미지 픽셀 기준.

export type CardElement = {
  id: string;
  kind: "text" | "box";
  label: string; // 편집 패널에 보이는 이름(예: 제목, 날짜)
  x: number;
  y: number;
  w: number;
  h: number; // 상자 높이. 글 요소는 0이면 줄 수만큼 자동, 아니면 글 상자 높이(세로 정렬 기준)
  text: string;
  fontSize: number;
  color: string; // #rrggbb
  align: "left" | "center" | "right";
  valign: "top" | "middle" | "bottom";
  bold: boolean;
  shadow: boolean;
  shadowColor: string; // #rrggbb
  shadowOpacity: number; // 0~1
  shadowBlur: number; // 흐림(px)
  shadowX: number; // 가로 거리(px)
  shadowY: number; // 세로 거리(px, 깊이)
  opacity: number; // 0~1 불투명도(상자 채우기·글자)
  radius: number; // 상자 모서리
  editable: boolean; // false면 틀에 고정(카드뉴스에서 고치지 못함)
};

// backgroundColor·backgroundPath가 없으면 틀 전체 배경을 쓴다
export type CardLayout = { id: string; name: string; elements: CardElement[]; backgroundColor?: string | null; backgroundPath?: string | null };
// order: 페이지에서 바꾼 레이어 순서(요소 id). 없으면 장 모양 순서
export type CardSlide = { id: string; layoutId: string; elements: CardElement[]; order?: string[] };

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
export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

const BASE: Omit<CardElement, "id"> = {
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
  valign: "top",
  bold: false,
  shadow: false,
  shadowColor: "#141e3c",
  shadowOpacity: 0.25,
  shadowBlur: 12,
  shadowX: 0,
  shadowY: 0,
  opacity: 1,
  radius: 0,
  editable: true,
};

export function textElement(over: Partial<CardElement>): CardElement {
  return { id: newId(), ...BASE, ...over };
}

export function boxElement(over: Partial<CardElement>): CardElement {
  return textElement({ kind: "box", label: "상자", text: "", w: 920, h: 600, opacity: 0.45, radius: 28, editable: false, shadowBlur: 24, ...over });
}

// 예전에 저장한 요소에는 새 칸(세로 정렬·그림자 세부값)이 없다. 예전 "은은한 그림자"와 같은 모양이 되게 채운다
export function normalizeElement(e: Partial<CardElement>): CardElement {
  const n = { ...BASE, id: newId(), ...e } as CardElement;
  if (e.shadowBlur === undefined) n.shadowBlur = n.kind === "text" ? Math.round(n.fontSize * 0.25) : 24;
  return n;
}

// 보내 준 카드뉴스 예시를 본뜬 기본 장 모양. 1080×1350 기준이며 다른 크기는 비율로 옮긴다
export const LAYOUT_PRESETS = ["표지", "본문", "2단 안내", "일반 공지", "달력"] as const;
export type LayoutPreset = (typeof LAYOUT_PRESETS)[number];

const INK = "#3d4a66";

function presetElements(preset: LayoutPreset, header: string): CardElement[] {
  const headerEl = () => textElement({ label: "상단 문구", text: header, x: 140, y: 40, w: 800, fontSize: 26, align: "center", editable: false, opacity: 0.85 });
  const title = (over: Partial<CardElement>) => textElement({ label: "제목", bold: true, shadow: true, shadowBlur: 24, ...over });
  switch (preset) {
    case "표지":
      return [
        headerEl(),
        title({ text: "사물함\n정리 안내", x: 80, y: 330, w: 920, fontSize: 120, shadowBlur: 30 }),
        textElement({ label: "날짜", text: "기간: 2026.8.24(월) ~ 2026.8.28(금)", x: 84, y: 680, w: 920, fontSize: 36 }),
      ];
    case "본문":
      return [
        title({ text: "사물함 정리 안내", x: 80, y: 90, w: 920, fontSize: 96, align: "center" }),
        boxElement({ label: "내용 상자", x: 60, y: 300, w: 960, h: 980 }),
        textElement({
          label: "내용",
          text: "● 정리 기간 | 8/24(월) ~ 8/28(금)\n\n● 정리 안내 |\n- 사물함을 사용하시던 학우분들께서는 기간 내에 물품을 가져가 주세요.",
          x: 130,
          y: 380,
          w: 820,
          fontSize: 40,
          color: INK,
        }),
      ];
    case "2단 안내":
      return [
        title({ text: "단톡방 안내", x: 80, y: 90, w: 920, fontSize: 88, align: "center", shadowBlur: 22 }),
        boxElement({ label: "왼쪽 상자", x: 70, y: 250, w: 450, h: 300, opacity: 0.4, radius: 20 }),
        boxElement({ label: "오른쪽 상자", x: 560, y: 250, w: 450, h: 300, opacity: 0.4, radius: 20 }),
        textElement({ label: "왼쪽 글", text: "● 전학년 공지방\n- 학과 전체 공지", x: 100, y: 285, w: 390, fontSize: 34, color: INK }),
        textElement({ label: "오른쪽 글", text: "● 학년별 공지방\n- 각 학년 공지", x: 590, y: 285, w: 390, fontSize: 34, color: INK }),
        textElement({ label: "아래 글", text: "● 문의 | 오픈채팅방", x: 100, y: 640, w: 880, fontSize: 38, color: INK }),
      ];
    case "일반 공지":
      return [
        boxElement({ label: "제목 띠", x: 0, y: 0, w: 1080, h: 300, color: INK, opacity: 0.9, radius: 0, shadow: true, shadowY: 8 }),
        headerEl(),
        title({ text: "공지 제목", x: 80, y: 110, w: 920, h: 150, fontSize: 84, valign: "middle", shadow: false }),
        boxElement({ label: "내용 상자", x: 60, y: 360, w: 960, h: 820, opacity: 0.55, radius: 28 }),
        textElement({
          label: "내용",
          text: "● 일시 | 2026.11.30(월) 18:00\n● 장소 | 학생회실\n\n안내할 내용을 적어 주세요.",
          x: 120,
          y: 420,
          w: 840,
          h: 700,
          fontSize: 40,
          color: INK,
        }),
        textElement({ label: "문의", text: "문의 | 학생회 오픈채팅방", x: 80, y: 1230, w: 920, fontSize: 32, align: "center", opacity: 0.9 }),
      ];
    case "달력": {
      // 7열 × 5줄 칸. 칸 상자·요일은 고정, 날짜 칸 글은 고칠 수 있다(예: "3\n개강총회")
      const left = 78;
      const colW = 132;
      const top = 360;
      const rowH = 175;
      const days = ["일", "월", "화", "수", "목", "금", "토"];
      const out: CardElement[] = [
        headerEl(),
        title({ text: "11월 학사 일정", x: 80, y: 110, w: 920, fontSize: 80, align: "center" }),
        boxElement({ label: "달력 바탕", x: 60, y: 260, w: 960, h: 1000, opacity: 0.35, radius: 28 }),
      ];
      days.forEach((d, c) =>
        out.push(textElement({ label: `${d}요일`, text: d, x: left + c * colW, y: 290, w: colW, fontSize: 32, bold: true, align: "center", editable: false, color: c === 0 ? "#c0392b" : c === 6 ? "#2c5aa0" : INK })),
      );
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 7; c++) {
          const day = r * 7 + c + 1; // 2026년 11월(1일이 일요일) 기준. 다른 달은 칸 글을 고쳐 쓴다
          out.push(boxElement({ label: `칸 ${r + 1}-${c + 1}`, x: left + c * colW + 4, y: top + r * rowH + 4, w: colW - 8, h: rowH - 8, opacity: 0.55, radius: 12 }));
          out.push(
            textElement({
              label: `${r + 1}주 ${days[c]}`,
              text: day <= 30 ? String(day) : "",
              x: left + c * colW + 14,
              y: top + r * rowH + 12,
              w: colW - 28,
              fontSize: 28,
              color: c === 0 ? "#c0392b" : c === 6 ? "#2c5aa0" : INK,
            }),
          );
        }
      }
      return out;
    }
  }
}

export function presetLayout(preset: LayoutPreset, width = 1080, height = 1350, header = "학생회 이름"): CardLayout {
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
  return { id: newId(), name: preset, elements: presetElements(preset, header).map(scale) };
}

export function defaultLayouts(width = 1080, height = 1350, header = "학생회 이름"): CardLayout[] {
  return LAYOUT_PRESETS.map((p) => presetLayout(p, width, height, header));
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

// 글 상자 안에서 첫 줄이 놓일 y(세로 정렬). lineCount줄의 글이 높이 h 상자 안에 들어간다
export function textTop(el: Pick<CardElement, "y" | "h" | "valign" | "fontSize">, lineCount: number): number {
  const total = lineCount * el.fontSize * LINE_HEIGHT;
  const box = el.h > 0 ? el.h : total;
  return el.y + (el.valign === "middle" ? (box - total) / 2 : el.valign === "bottom" ? box - total : 0);
}

export function shadowRgba(el: Pick<CardElement, "shadowColor" | "shadowOpacity">): string {
  const hex = HEX_COLOR.test(el.shadowColor) ? el.shadowColor : "#141e3c";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${el.shadowOpacity})`;
}

// 저장된 JSON을 안전하게 읽는다(모양이 다르면 버리고, 빠진 칸은 기본값으로)
export function parseLayouts(value: unknown): CardLayout[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((l): l is CardLayout => !!l && typeof l === "object" && Array.isArray((l as CardLayout).elements))
    .map((l) => ({ ...l, elements: l.elements.map(normalizeElement) }));
}

export function parseSlides(value: unknown): CardSlide[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((s): s is CardSlide => !!s && typeof s === "object" && Array.isArray((s as CardSlide).elements))
    .map((s) => ({ ...s, elements: s.elements.map(normalizeElement) }));
}

// 장에 그릴 요소: 틀에 고정된 요소는 지금 틀에서(틀을 고치면 이미 만든 카드뉴스에도 반영), 고칠 수 있는 칸은 장에 저장된 값으로.
// 순서는 장에서 바꾼 레이어 순서(order)가 있으면 그것, 없으면 틀의 장 모양을 따른다. 틀에서 장 모양이 지워졌으면 장에 저장된 요소를 그대로 쓴다.
export function slideElements(slide: CardSlide, layouts: CardLayout[]): CardElement[] {
  const layout = layouts.find((l) => l.id === slide.layoutId);
  const els = layout ? layout.elements.map((e) => (e.editable ? (slide.elements.find((s) => s.id === e.id) ?? e) : e)) : slide.elements;
  if (!slide.order?.length) return els;
  const rank = new Map(slide.order.map((id, i) => [id, i]));
  return [...els].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

// 새 장: 장 모양의 고칠 수 있는 칸만 복사해 둔다
export function newSlide(layout: CardLayout): CardSlide {
  return { id: newId(), layoutId: layout.id, elements: structuredClone(layout.elements.filter((e) => e.editable)) };
}

export type LayerMove = "front" | "forward" | "backward" | "back";

// 레이어 순서 바꾸기(배열 뒤쪽이 위에 그려진다)
export function moveLayer<T extends { id: string }>(items: T[], id: string, move: LayerMove): T[] {
  const i = items.findIndex((e) => e.id === id);
  if (i < 0) return items;
  const to = move === "front" ? items.length - 1 : move === "back" ? 0 : move === "forward" ? Math.min(items.length - 1, i + 1) : Math.max(0, i - 1);
  if (to === i) return items;
  const next = [...items];
  const [item] = next.splice(i, 1);
  next.splice(to, 0, item);
  return next;
}

// 격자 칸 크기(px). 0은 끄기
export const GRID_SIZES = [0, 10, 20, 40, 60];

// 격자에 맞추기(size가 0이면 그대로)
export const snap = (v: number, size: number) => (size > 0 ? Math.round(v / size) * size : Math.round(v));
