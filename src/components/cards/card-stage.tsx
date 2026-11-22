"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { fontCss, LINE_HEIGHT, type CardElement } from "@/lib/cards/model";
import { textLines, type CardAssets, type CardFrame } from "@/lib/cards/render";

// 카드 한 장의 편집 화면. 실제 크기(px) 좌표를 화면 폭에 맞춰 줄여 보여 주고,
// 요소를 마우스로 끌어 옮기고 오른쪽 아래 손잡이로 폭(상자는 높이도)을 바꾼다. 방향키로 1px(Shift: 10px)씩 옮긴다.
// locked: 카드뉴스 화면에서 틀에 고정된 요소(editable=false)는 고르지 못한다.
export function CardStage({
  frame,
  assets,
  elements,
  selectedId,
  onSelect,
  onChange,
  lockFixed,
}: {
  frame: CardFrame;
  assets: CardAssets;
  elements: CardElement[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CardElement>) => void;
  lockFixed: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; ox: number; oy: number; ow: number; oh: number } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / frame.width));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [frame.width]);

  const start = (e: ReactPointerEvent, el: CardElement, mode: "move" | "resize") => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: el.id, mode, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y, ow: el.w, oh: el.h };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round((e.clientX - d.sx) / scale);
    const dy = Math.round((e.clientY - d.sy) / scale);
    if (d.mode === "move") onChange(d.id, { x: d.ox + dx, y: d.oy + dy });
    else onChange(d.id, { w: Math.max(40, d.ow + dx), h: Math.max(20, d.oh + dy) });
  };
  const end = () => (drag.current = null);

  const selected = elements.find((e) => e.id === selectedId);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!selected || !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
    e.preventDefault();
    const step = e.shiftKey ? 10 : 1;
    const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    onChange(selected.id, { x: selected.x + dx, y: selected.y + dy });
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
                  height: el.kind === "box" ? el.h : undefined,
                  opacity: el.opacity,
                  ...(el.kind === "box"
                    ? { backgroundColor: el.color, borderRadius: el.radius }
                    : {
                        font: fontCss(el, assets.fontFamily),
                        lineHeight: `${lh}px`,
                        color: el.color,
                        textAlign: el.align,
                        whiteSpace: "pre",
                        textShadow: el.shadow ? `0 0 ${el.fontSize * 0.25}px rgba(20,30,60,0.25)` : undefined,
                      }),
                }}
              >
                {el.kind === "text" && textLines(el, assets.fontFamily).map((line, i) => <div key={i}>{line || " "}</div>)}
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
        </div>
      </div>
    </div>
  );
}
