"use client";

import { createClient } from "@/lib/supabase/client";
import { fontCss, LINE_HEIGHT, shadowRgba, textTop, wrapText, type CardElement, type CardLayout, type CardTemplate } from "./model";
import { buildPdf } from "./pdf";

// 카드 한 장을 캔버스에 그린다(미리보기와 같은 줄바꿈 함수를 쓴다). 그림·PDF 파일은 브라우저에서 만든다.

export type CardAssets = { fontFamily: string; background: ImageBitmap | null; backgroundUrl: string | null };
export type CardFrame = { width: number; height: number; background_color: string };

const FONT_TYPES: Record<string, string> = { otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2" };
export const FONT_ACCEPT = ".otf,.ttf,.woff,.woff2";
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

const fonts = new Map<string, Promise<string>>();
const backgrounds = new Map<string, Promise<Pick<CardAssets, "background" | "backgroundUrl">>>();

// 틀의 글꼴·배경 그림 파일을 비공개 저장소에서 받아 쓴다(볼 수 있는지는 저장소 RLS가 정한다). 같은 파일은 한 번만 받는다
function loadFont(path: string): Promise<string> {
  if (!fonts.has(path)) {
    fonts.set(
      path,
      (async () => {
        const { data } = await createClient().storage.from("card-assets").download(path);
        if (!data) return "";
        const family = `card-font-${path.replace(/[^a-z0-9]/gi, "").slice(-16)}`;
        const face = new FontFace(family, await data.arrayBuffer());
        return face
          .load()
          .then(() => (document.fonts.add(face), family))
          .catch(() => "");
      })(),
    );
  }
  return fonts.get(path)!;
}

function loadBackground(path: string) {
  if (!backgrounds.has(path)) {
    backgrounds.set(
      path,
      (async () => {
        const { data } = await createClient().storage.from("card-assets").download(path);
        return data ? { background: await createImageBitmap(data), backgroundUrl: URL.createObjectURL(data) } : { background: null, backgroundUrl: null };
      })(),
    );
  }
  return backgrounds.get(path)!;
}

export async function loadAssets(backgroundPath: string | null, fontPath: string | null): Promise<CardAssets> {
  const [fontFamily, bg] = await Promise.all([fontPath ? loadFont(fontPath) : "", backgroundPath ? loadBackground(backgroundPath) : null]);
  return { fontFamily, background: bg?.background ?? null, backgroundUrl: bg?.backgroundUrl ?? null };
}

// 장 모양마다 배경을 따로 정할 수 있다(없으면 틀 배경)
export function layoutFrame(template: CardTemplate, layout: CardLayout | undefined): CardFrame & { background_path: string | null } {
  return {
    width: template.width,
    height: template.height,
    background_color: layout?.backgroundColor ?? template.background_color,
    background_path: layout?.backgroundPath ?? template.background_path,
  };
}

// 파일 하나를 그 기수 폴더에 올리고 경로를 돌려준다(국장 이상만 저장소 RLS가 허락한다)
export async function uploadAsset(termId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const contentType = FONT_TYPES[ext] ?? file.type;
  const path = `${termId}/${crypto.randomUUID()}.${ext}`;
  // 브라우저는 OTF·TTF 파일의 형식을 비워 두는 경우가 많아(→ 저장소가 octet-stream으로 거절) 확장자로 정한 형식을 붙여 보낸다
  const typed = new File([file], file.name, { type: contentType });
  const { error } = await createClient().storage.from("card-assets").upload(path, typed, { contentType });
  if (error) throw new Error(error.message.includes("mime") ? "PNG·JPG·WEBP 그림 또는 OTF·TTF·WOFF 글꼴만 올릴 수 있습니다." : "파일을 올리지 못했습니다. 10MB 이하인지 확인해 주세요.");
  return path;
}

// 캔버스 글자 폭 재기(미리보기도 이 함수로 줄을 나눈다)
let measureCtx: CanvasRenderingContext2D | null = null;
export function measurer(el: CardElement, family: string) {
  measureCtx ??= document.createElement("canvas").getContext("2d");
  const ctx = measureCtx!;
  ctx.font = fontCss(el, family);
  return (s: string) => ctx.measureText(s).width;
}

export function textLines(el: CardElement, family: string) {
  return wrapText(measurer(el, family), el.text, el.w);
}

// scale: 작은 미리보기(왼쪽 페이지 목록)용 축소 비율. 내려받기는 1
export function drawSlide(canvas: HTMLCanvasElement, frame: CardFrame, elements: CardElement[], assets: CardAssets, scale = 1) {
  canvas.width = Math.round(frame.width * scale);
  canvas.height = Math.round(frame.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  ctx.fillStyle = frame.background_color;
  ctx.fillRect(0, 0, frame.width, frame.height);
  if (assets.background) {
    // 배경은 화면을 꽉 채우게(넘치는 부분은 잘라낸다)
    const b = assets.background;
    const s = Math.max(frame.width / b.width, frame.height / b.height);
    ctx.drawImage(b, (frame.width - b.width * s) / 2, (frame.height - b.height * s) / 2, b.width * s, b.height * s);
  }
  for (const el of elements) {
    ctx.save();
    ctx.globalAlpha = el.opacity;
    if (el.shadow) {
      // 캔버스 그림자 값은 확대·축소를 따르지 않아 직접 곱한다
      ctx.shadowColor = shadowRgba(el);
      ctx.shadowBlur = el.shadowBlur * scale;
      ctx.shadowOffsetX = el.shadowX * scale;
      ctx.shadowOffsetY = el.shadowY * scale;
    }
    if (el.kind === "box") {
      ctx.fillStyle = el.color;
      ctx.beginPath();
      ctx.roundRect(el.x, el.y, el.w, el.h, el.radius);
      ctx.fill();
    } else {
      ctx.font = fontCss(el, assets.fontFamily);
      ctx.fillStyle = el.color;
      ctx.textBaseline = "top";
      ctx.textAlign = el.align;
      const tx = el.align === "left" ? el.x : el.align === "center" ? el.x + el.w / 2 : el.x + el.w;
      const lh = el.fontSize * LINE_HEIGHT;
      // 줄 높이 안에서 글자가 가운데 오도록 반 줄 간격만큼 내린다(미리보기의 CSS line-height와 맞춘다)
      const offset = (lh - el.fontSize) / 2;
      const lines = wrapText((s) => ctx.measureText(s).width, el.text, el.w);
      const top = textTop(el, lines.length);
      lines.forEach((line, i) => ctx.fillText(line, tx, top + offset + i * lh));
    }
    ctx.restore();
  }
}

export type ExportFormat = "png" | "jpeg" | "pdf";
export type ExportPage = { frame: CardFrame; elements: CardElement[]; assets: CardAssets };

function save(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement("a"), { href: url, download: fileName }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toBlob(page: ExportPage, type: "image/png" | "image/jpeg"): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawSlide(canvas, page.frame, page.elements, page.assets);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("그림을 만들지 못했습니다."))), type, 0.92));
}

// 페이지들을 내려받는다. PNG·JPEG는 페이지마다 파일 하나, PDF는 모든 페이지를 파일 하나로
export async function exportPages(pages: ExportPage[], format: ExportFormat, baseName: string, numbers: number[]) {
  if (format === "pdf") {
    const images = await Promise.all(
      pages.map(async (p) => ({ jpeg: new Uint8Array(await (await toBlob(p, "image/jpeg")).arrayBuffer()), width: p.frame.width, height: p.frame.height })),
    );
    save(buildPdf(images), `${baseName}.pdf`);
    return;
  }
  for (const [i, page] of pages.entries()) {
    const blob = await toBlob(page, format === "png" ? "image/png" : "image/jpeg");
    save(blob, `${baseName}-${String(numbers[i]).padStart(2, "0")}.${format === "jpeg" ? "jpg" : "png"}`);
    // 브라우저가 연속 내려받기를 막지 않도록 조금 쉰다
    if (pages.length > 1) await new Promise((r) => setTimeout(r, 350));
  }
}
