"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  fontCss,
  LINE_HEIGHT,
  shadowRgba,
  smartSnap,
  snap,
  textTop,
  type CardElement,
} from "@/lib/cards/model";
import { textLines, type CardAssets, type CardFrame } from "@/lib/cards/render";

// 카드 한 장의 편집 화면. 실제 크기(px) 좌표를 화면 폭에 맞춰 줄여 보여 주고,
// 요소를 마우스로 끌어 옮기고 오른쪽 아래 손잡이로 가로·세로 크기를 바꾼다. 방향키로 1px(Shift: 10px)씩 옮긴다.
// grid: 격자 칸 크기(px). 0이 아니면 끌기·크기 바꾸기·방향키가 격자 선에 맞춰진다.
// locked: 카드뉴스 화면에서 틀에 고정된 요소(editable=false)는 고르지 못한다.
// 확대: +/− 버튼이나 Ctrl(⌘)+휠로 피그마처럼 키운다. 800% 이상이면 1px 픽셀 격자가 보인다.
const ZOOMS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32];
const PIXEL_GRID_FROM = 8;

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = useState(0.4);
  const [zoom, setZoom] = useState<number | null>(null); // null: 화면에 맞춤
  const scale = zoom ?? fitScale;
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  // 휠로 확대할 때 마우스 아래 지점이 그대로 있게 스크롤을 맞춘다
  const anchor = useRef<{
    ix: number;
    iy: number;
    cx: number;
    cy: number;
  } | null>(null);
  const drag = useRef<{
    id: string;
    mode: "move" | "resize";
    sx: number;
    sy: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
    text: boolean;
  } | null>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    // 폭과 화면 높이(75%) 둘 다에 맞춰 줄인다. 세로로 긴 카드도 한 화면에 다 보이게
    const fit = () =>
      setFitScale(
        Math.min(
          1,
          el.clientWidth / frame.width,
          (window.innerHeight * 0.75) / frame.height,
        ),
      );
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    window.addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, [frame.width, frame.height]);

  useLayoutEffect(() => {
    const a = anchor.current;
    const el = scrollRef.current;
    if (!a || !el) return;
    el.scrollLeft = a.ix * scale - a.cx;
    el.scrollTop = a.iy * scale - a.cy;
    anchor.current = null;
  }, [scale]);

  const zoomTo = (next: number, at?: { x: number; y: number }) => {
    const el = scrollRef.current;
    const clamped = Math.min(ZOOMS[ZOOMS.length - 1], Math.max(ZOOMS[0], next));
    if (el) {
      const r = el.getBoundingClientRect();
      const cx = at ? at.x - r.left : el.clientWidth / 2;
      const cy = at ? at.y - r.top : el.clientHeight / 2;
      anchor.current = {
        ix: (el.scrollLeft + cx) / scale,
        iy: (el.scrollTop + cy) / scale,
        cx,
        cy,
      };
    }
    setZoom(clamped);
  };
  const step = (dir: 1 | -1, at?: { x: number; y: number }) =>
    zoomTo(
      dir > 0
        ? (ZOOMS.find((z) => z > scale + 1e-6) ?? scale)
        : ([...ZOOMS].reverse().find((z) => z < scale - 1e-6) ?? scale),
      at,
    );

  const stepRef = useRef(step);
  useLayoutEffect(() => {
    stepRef.current = step;
  });
  // Ctrl(⌘)+휠 확대·축소. React의 휠 이벤트는 기본 동작을 막지 못해 직접 단다
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      stepRef.current(e.deltaY < 0 ? 1 : -1, { x: e.clientX, y: e.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 글 요소의 높이가 0(자동)이면 줄 수로 잰 높이
  const heightOf = (el: CardElement) =>
    el.kind === "text" && el.h <= 0
      ? textLines(el, assets.fontFamily).length * el.fontSize * LINE_HEIGHT
      : el.h;

  const start = (
    e: ReactPointerEvent,
    el: CardElement,
    mode: "move" | "resize",
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect(el.id);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = {
      id: el.id,
      mode,
      sx: e.clientX,
      sy: e.clientY,
      ox: el.x,
      oy: el.y,
      ow: el.w,
      oh: Math.round(heightOf(el)),
      text: el.kind === "text",
    };
  };
  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / scale;
    const dy = (e.clientY - d.sy) / scale;
    const resize = d.mode === "resize";
    let r = resize
      ? { x: d.ox, y: d.oy, w: Math.max(40, snap(d.ow + dx, grid)), h: Math.max(20, snap(d.oh + dy, grid)) }
      : { x: snap(d.ox + dx, grid), y: snap(d.oy + dy, grid), w: d.ow, h: d.oh };
    // 격자를 끈 때만 빨간 기준선에 붙인다(Alt를 누르면 붙이지 않는다)
    let g: { x: number | null; y: number | null } = { x: null, y: null };
    if (grid === 0 && !e.altKey) {
      const others = elements.filter((o) => o.id !== d.id).map((o) => ({ x: o.x, y: o.y, w: o.w, h: heightOf(o) }));
      const m = smartSnap(r, others, frame, 6 / scale, resize);
      r = resize ? { ...r, w: r.w + m.dx, h: r.h + m.dy } : { ...r, x: r.x + m.dx, y: r.y + m.dy };
      g = { x: m.guideX, y: m.guideY };
    }
    setGuides(g);
    if (resize) onChange(d.id, { w: r.w, h: r.h }, `resize:${d.id}`);
    else onChange(d.id, { x: r.x, y: r.y }, `move:${d.id}`);
  };
  const end = () => {
    drag.current = null;
    setGuides({ x: null, y: null });
  };

  const selected = elements.find((e) => e.id === selectedId);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (
      !selected ||
      !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
    )
      return;
    e.preventDefault();
    const step = grid > 0 ? grid : e.shiftKey ? 10 : 1;
    const dx =
      e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
    const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    onChange(
      selected.id,
      { x: snap(selected.x + dx, grid), y: snap(selected.y + dy, grid) },
      `key:${selected.id}`,
    );
  };

  return (
    <div ref={boxRef} className="w-full space-y-2">
      <div
        className="flex items-center justify-center gap-1 text-sm"
        role="group"
        aria-label="확대·축소"
      >
        <button
          type="button"
          className={ZOOM_BTN}
          onClick={() => step(-1)}
          aria-label="축소"
        >
          −
        </button>
        <span className="w-16 text-center tabular-nums" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          className={ZOOM_BTN}
          onClick={() => step(1)}
          aria-label="확대"
        >
          +
        </button>
        <button
          type="button"
          className={`${ZOOM_BTN} w-auto px-2`}
          onClick={() => setZoom(1)}
        >
          100%
        </button>
        <button
          type="button"
          className={`${ZOOM_BTN} w-auto px-2`}
          aria-pressed={zoom === null}
          onClick={() => setZoom(null)}
        >
          화면 맞춤
        </button>
        <span className="hidden text-xs text-muted sm:inline">
          Ctrl+휠로 확대 · 800%부터 픽셀 격자
        </span>
      </div>
      <div
        ref={scrollRef}
        className={
          zoom === null
            ? ""
            : "max-h-[75vh] overflow-auto rounded-lg border border-border-input"
        }
      >
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
            backgroundImage: assets.backgroundUrl
              ? `url(${assets.backgroundUrl})`
              : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
            }}
          >
            {elements.map((el) => {
              const locked = lockFixed && !el.editable;
              const isSel = el.id === selectedId;
              const lh = el.fontSize * LINE_HEIGHT;
              const lines =
                el.kind === "text" ? textLines(el, assets.fontFamily) : [];
              const shadow = el.shadow
                ? `${el.shadowX}px ${el.shadowY}px ${el.shadowBlur}px ${shadowRgba(el)}`
                : undefined;
              return (
                <div
                  key={el.id}
                  onPointerDown={
                    locked ? undefined : (e) => start(e, el, "move")
                  }
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
                      ? {
                          backgroundColor: el.color,
                          borderRadius: el.radius,
                          boxShadow: shadow,
                        }
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
                    <div
                      style={{
                        transform: `translateY(${textTop(el, lines.length) - el.y}px)`,
                      }}
                    >
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
            {scale >= PIXEL_GRID_FROM && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage: `linear-gradient(to right, rgba(120,120,120,.35) ${1 / scale}px, transparent ${1 / scale}px), linear-gradient(to bottom, rgba(120,120,120,.35) ${1 / scale}px, transparent ${1 / scale}px)`,
                  backgroundSize: "1px 1px",
                }}
              />
            )}
            {guides.x !== null && (
              <div aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 bg-red-500" style={{ left: guides.x, width: 1 / scale }} />
            )}
            {guides.y !== null && (
              <div aria-hidden="true" className="pointer-events-none absolute right-0 left-0 bg-red-500" style={{ top: guides.y, height: 1 / scale }} />
            )}
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
    </div>
  );
}

const ZOOM_BTN =
  "inline-flex size-9 items-center justify-center rounded-lg border border-border-input bg-surface font-semibold hover:bg-zinc-50 aria-pressed:border-accent dark:hover:bg-zinc-800";
