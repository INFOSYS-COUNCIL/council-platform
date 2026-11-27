"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fontCss, LINE_HEIGHT, shadowRgba, snap, textTop, type CardElement } from "@/lib/cards/model";
import { textLines, type CardAssets, type CardFrame } from "@/lib/cards/render";

// 카드 한 장의 편집 화면. 실제 크기(px) 좌표를 화면 폭에 맞춰 줄여 보여 주고,
// 요소를 마우스로 끌어 옮기고 오른쪽 아래 손잡이로 가로·세로 크기를 바꾼다. 방향키로 1px(Shift: 10px)씩 옮긴다.
// grid: 격자 칸 크기(px). 0이 아니면 끌기·크기 바꾸기·방향키가 격자 선에 맞춰진다.
// locked: 카드뉴스 화면에서 틀에 고정된 요소(editable=false)는 고르지 못한다.
export function CardStage({
  frame,
  assets,
  elements,
  selectedId,
  onSelect,
  onChange,
  lockFixed,
  grid = 0,
}: {
  frame: CardFrame;
  assets: CardAssets;
  elements: CardElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CardElement>, key?: string) => void;
  lockFixed: boolean;
  grid?: number;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number; text: boolean } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // 폭과 화면 높이(75%) 둘 다에 맞춰 줄인다. 세로로 긴 카드도 한 화면에 다 보이게
    const fit = () => setScale(Math.min(1, el.clientWidth / frame.width, (window.innerHeight * 0.75) / frame.height));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [frame.width, frame.height]);

  // 글 요소의 높이가 0(자동)이면 줄 수로 잰 높이
  const heightOf = (el: CardElement) => (el.kind === "text" && el.h <= 0 ? textLines(el, assets.fontFamily).length * el.fontSize * LINE_HEIGHT : el.h);

  const start = (e: ReactPointerEvent, el: CardElement, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: el.id, mode, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: Math.round(heightOf(el)), text: el.kind === "text" };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    if (d.mode === "move") onChange(d.id, { x: snap(d.ox + dx, grid), y: snap(d.oy + dy, grid) }, `move:${d.id}`);
    else onChange(d.id, { w: Math.max(40, snap(d.ow + dx, grid)), h: Math.max(20, snap(d.oh + dy, grid)) }, `resize:${d.id}`);
  };
  const end = () => (drag.current = null);

  const selected = elements.find((e) => e.id === selectedId);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selected || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const step = grid > 0 ? grid : e.shiftKey ? 10 : 1;
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    onChange(selected.id, { x: snap(selected.x + dx, grid), y: snap(selected.y + dy, grid) }, `key:${selected.id}`);
  };

  return (
    <div ref={boxRef} className="w-full">
      <div
        role="application"
        aria-label="카드 편집 화면. 요소를 끌어 옮기거나, 고른 뒤 방향키로 옮깁니다."
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerDown={() => onSelect(null)}
        className="relative mx-auto touch-none overflow-hidden shadow-lg outline-offset-4 focus-visible:outline-2 focus-visible:outline-accent"
        style={{
          width: frame.width * scale,
          height: frame.height * scale,
          backgroundColor: frame.background_color,
          backgroundImage: assets.backgroundUrl ? `url(${assets.backgroundUrl})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
          {elements.map((el) => {
            const locked = lockFixed && !el.editable;
            const isSel = el.id === selectedId;
            const lh = el.fontSize * LINE_HEIGHT;
            const lines = el.kind === "text" ? textLines(el, assets.fontFamily) : [];
            const shadow = el.shadow ? `${el.shadowX}px ${el.shadowY}px ${el.shadowBlur}px ${shadowRgba(el)}` : undefined;
            return (
              <div
                key={el.id}
                onPointerDown={locked ? undefined : (e) => start(e, el, "move")}
                onPointerMove={move}
                onPointerUp={end}
                className={`absolute ${locked ? "pointer-events-none" : "cursor-move"} ${isSel ? "outline-[3px] outline-blue-500 outline-dashed" : locked ? "" : "hover:outline-2 hover:outline-blue-300 hover:outline-dashed"}`}
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.w,
                  height: heightOf(el),
                  opacity: el.opacity,
                  ...(el.kind === "box"
                    ? { backgroundColor: el.color, borderRadius: el.radius, boxShadow: shadow }
                    : {
                        font: fontCss(el, assets.fontFamily),
                        lineHeight: `${lh}px`,
                        color: el.color,
                        textAlign: el.align,
                        whiteSpace: "pre",
                        textShadow: shadow,
                      }),
                }}
              >
                {el.kind === "text" && (
                  <div style={{ transform: `translateY(${textTop(el, lines.length) - el.y}px)` }}>
                    {lines.map((line, i) => (
                      <div key={i}>{line || " "}</div>
                    ))}
                  </div>
                )}
                {isSel && !locked && (
                  <span
                    aria-hidden="true"
                    onPointerDown={(e) => start(e, el, "resize")}
                    onPointerMove={move}
                    onPointerUp={end}
                    className="absolute -right-3 -bottom-3 size-6 cursor-nwse-resize rounded-full border-2 border-white bg-blue-500 shadow"
                    style={{ transform: `scale(${1 / scale})` }}
                  />
                )}
              </div>
            );
          })}
          {grid > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                // 줄인 화면에서도 선이 1px 이상 보이게
                backgroundImage: `linear-gradient(to right, rgba(59,130,246,.35) ${1 / scale}px, transparent ${1 / scale}px), linear-gradient(to bottom, rgba(59,130,246,.35) ${1 / scale}px, transparent ${1 / scale}px)`,
                backgroundSize: `${grid}px ${grid}px`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
