"use client";

import { createClient } from "@/lib/supabase/client";
import { fontCss, LINE_HEIGHT, wrapText, type CardElement } from "./model";

// 카드 한 장을 실제 크기 캔버스에 그린다(미리보기와 같은 줄바꿈 함수를 쓴다). 그림 파일은 브라우저에서 만든다.

export type CardAssets = { fontFamily: string; background: ImageBitmap | null; backgroundUrl: string | null };
export type CardFrame = { width: number; height: number; background_color: string };

const FONT_TYPES: Record<string, string> = { otf: "font/otf", ttf: "font/ttf", woff: "font/woff", woff2: "font/woff2" };
export const FONT_ACCEPT = ".otf,.ttf,.woff,.woff2";
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

const loaded = new Map<string, Promise<CardAssets>>();

// 틀의 배경 그림·글꼴 파일을 비공개 저장소에서 받아 쓴다(볼 수 있는지는 저장소 RLS가 정한다)
export function loadAssets(backgroundPath: string | null, fontPath: string | null): Promise<CardAssets> {
  const key = `${backgroundPath}|${fontPath}`;
  if (!loaded.has(key)) {
    loaded.set(
      key,
      (async () => {
        const supabase = createClient();
        let fontFamily = "";
        let background: ImageBitmap | null = null;
        let backgroundUrl: string | null = null;
        if (fontPath) {
          const { data } = await supabase.storage.from("card-assets").download(fontPath);
          if (data) {
            fontFamily = `card-font-${fontPath.replace(/[^a-z0-9]/gi, "").slice(-16)}`;
            const face = new FontFace(fontFamily, await data.arrayBuffer());
            await face.load().then(() => document.fonts.add(face)).catch(() => (fontFamily = ""));
          }
        }
        if (backgroundPath) {
          const { data } = await supabase.storage.from("card-assets").download(backgroundPath);
          if (data) {
            background = await createImageBitmap(data);
            backgroundUrl = URL.createObjectURL(data);
          }
        }
        return { fontFamily, background, backgroundUrl };
      })(),
    );
  }
  return loaded.get(key)!;
}

export function forgetAssets() {
  loaded.clear();
}

// 파일 하나를 그 기수 폴더에 올리고 경로를 돌려준다(국장 이상만 저장소 RLS가 허락한다)
export async function uploadAsset(termId: string, file: File): Promise<string> {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  const contentType = FONT_TYPES[ext] ?? file.type;
  const path = `${termId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await createClient().storage.from("card-assets").upload(path, file, { contentType });
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

export function drawSlide(canvas: HTMLCanvasElement, frame: CardFrame, elements: CardElement[], assets: CardAssets) {
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d")!;
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
      if (el.shadow) {
        ctx.shadowColor = "rgba(20, 30, 60, 0.25)";
        ctx.shadowBlur = el.fontSize * 0.25;
      }
      const tx = el.align === "left" ? el.x : el.align === "center" ? el.x + el.w / 2 : el.x + el.w;
      const lh = el.fontSize * LINE_HEIGHT;
      // 줄 높이 안에서 글자가 가운데 오도록 반 줄 간격만큼 내린다(미리보기의 CSS line-height와 맞춘다)
      const offset = (lh - el.fontSize) / 2;
      wrapText((s) => ctx.measureText(s).width, el.text, el.w).forEach((line, i) => ctx.fillText(line, tx, el.y + offset + i * lh));
    }
    ctx.restore();
  }
}

export async function downloadSlide(frame: CardFrame, elements: CardElement[], assets: CardAssets, format: "png" | "jpeg", fileName: string) {
  const canvas = document.createElement("canvas");
  drawSlide(canvas, frame, elements, assets);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, `image/${format}`, 0.92));
  if (!blob) throw new Error("그림을 만들지 못했습니다.");
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: `${fileName}.${format === "jpeg" ? "jpg" : "png"}` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
