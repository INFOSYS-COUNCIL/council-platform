"use client";

import { useEffect, useRef } from "react";
import type { CardElement } from "@/lib/cards/model";
import { drawSlide, type CardAssets, type CardFrame } from "@/lib/cards/render";

// 페이지 작은 미리보기(왼쪽 페이지 목록·장 모양 고르기). 내려받기와 같은 그리기 함수로 그린다
export function SlideThumb({ frame, elements, assets, width }: { frame: CardFrame; elements: CardElement[]; assets: CardAssets; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // 그릴 내용이 같으면 다시 그리지 않는다(부모가 그릴 때마다 새 배열을 넘겨도)
  const signature = JSON.stringify([frame, elements, assets.fontFamily, assets.backgroundUrl]);
  useEffect(() => {
    if (ref.current) drawSlide(ref.current, frame, elements, assets, width / frame.width);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, width]);
  return <canvas ref={ref} aria-hidden="true" className="block h-auto w-full" style={{ aspectRatio: `${frame.width} / ${frame.height}` }} />;
}
