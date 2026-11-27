"use client";

import { useState } from "react";
import { HEX_COLOR, type CardElement, type LayerMove } from "@/lib/cards/model";

const INPUT = "w-full rounded-lg border border-border-input bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LABEL = "block space-y-1 text-sm font-medium";
const SMALL_BTN = "rounded-lg border border-border-input px-2 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800";

// 숫자 칸: 입력 중에는 글자 그대로 두고, 범위 안의 숫자가 되면 바로 반영한다.
// 칸을 벗어날 때 빈 값·범위 밖이면 범위 안으로 맞춘다(입력 중에 8·400으로 튀던 문제)
export function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  className = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  // 고치는 중에만 입력한 글자를 쓰고, 아니면 늘 지금 값을 보여 준다
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    const fixed = draft.trim() === "" || !Number.isFinite(n) ? value : Math.min(max, Math.max(min, n));
    setDraft(null);
    if (fixed !== value) onChange(fixed);
  };
  return (
    <label className={`${LABEL} ${className}`}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        className={INPUT}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
      />
    </label>
  );
}

// 색 고르기 + 헥스 코드 입력(#rrggbb, # 없이도 된다)
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const apply = (raw: string) => {
    const hex = (raw.startsWith("#") ? raw : `#${raw}`).toLowerCase();
    if (HEX_COLOR.test(hex)) onChange(hex);
  };
  return (
    <div className={LABEL}>
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <input type="color" aria-label={`${label} 고르기`} value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border-input bg-surface" />
        <input
          aria-label={`${label} 헥스 코드`}
          className={`${INPUT} font-mono uppercase`}
          value={draft ?? value}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            setDraft(e.target.value);
            apply(e.target.value.trim());
          }}
          onBlur={() => setDraft(null)}
        />
      </span>
    </div>
  );
}

// 불투명도: 밀대로 끌거나 %를 숫자로 바로 넣는다
function Percent({ label, value, onChange, min = 0 }: { label: string; value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="space-y-1">
      <span className="block text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        <input type="range" aria-label={`${label} 끌어서 바꾸기`} min={min} max={1} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-coral-700" />
        <NumberField label={`${label}(%)`} value={Math.round(value * 100)} min={Math.round(min * 100)} max={100} onChange={(n) => onChange(n / 100)} className="w-20 [&>span]:sr-only" />
        <span aria-hidden="true" className="text-sm text-muted">%</span>
      </span>
    </div>
  );
}

// 고른 요소의 속성 편집. template: 틀 편집기(이름·고정 여부·지우기까지), 아니면 카드뉴스(글·크기·색·위치·순서)
export function ElementPanel({
  element,
  onChange,
  onDelete,
  onLayer,
  template,
}: {
  element: CardElement | undefined;
  onChange: (patch: Partial<CardElement>, key?: string) => void;
  onDelete?: () => void;
  onLayer?: (move: LayerMove) => void;
  template: boolean;
}) {
  if (!element) {
    return <p className="text-sm text-muted">카드에서 요소를 누르면 여기서 글·크기·색·위치를 바꿀 수 있습니다. 끌어서 옮기고(빨간 기준선에 붙음, Alt를 누르면 안 붙음), 오른쪽 아래 파란 점으로 가로·세로 크기를 바꿉니다. Ctrl+C·V로 복사·붙여 넣기.</p>;
  }
  const isText = element.kind === "text";
  const set = (field: keyof CardElement) => (v: CardElement[typeof field]) => onChange({ [field]: v } as Partial<CardElement>, `${field}:${element.id}`);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{element.label}</p>
        {onDelete && (
          <button type="button" onClick={onDelete} className="rounded-lg px-2 py-1 text-sm font-medium text-danger hover:bg-danger-bg">
            요소 지우기
          </button>
        )}
      </div>

      {template && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            <span>요소 이름</span>
            <input className={INPUT} value={element.label} maxLength={20} onChange={(e) => set("label")(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
            <input type="checkbox" checked={element.editable} onChange={(e) => onChange({ editable: e.target.checked })} className="size-4 accent-coral-700" />
            카드뉴스에서 고칠 수 있음
          </label>
        </div>
      )}

      {isText && (
        <label className={LABEL}>
          <span>글</span>
          <textarea className={`${INPUT} min-h-28`} value={element.text} maxLength={2000} onChange={(e) => set("text")(e.target.value)} />
        </label>
      )}

      {/* 위치·크기 */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold">위치·크기 (px)</legend>
        <div className="grid grid-cols-4 gap-2">
          <NumberField label="X" value={element.x} min={-5000} max={5000} onChange={set("x")} />
          <NumberField label="Y" value={element.y} min={-5000} max={5000} onChange={set("y")} />
          <NumberField label="가로" value={element.w} min={20} max={5000} onChange={set("w")} />
          <NumberField label="세로" value={element.h} min={isText ? 0 : 10} max={5000} onChange={set("h")} />
        </div>
        {isText && <p className="text-xs text-muted">글 상자 세로를 0으로 두면 줄 수에 맞춰 늘어납니다.</p>}
      </fieldset>

      {isText && (
        <div className="space-y-1">
          <span className="block text-sm font-medium">글자 크기</span>
          <span className="flex items-center gap-2">
            <input type="range" aria-label="글자 크기 끌어서 바꾸기" min={8} max={240} value={Math.min(240, element.fontSize)} onChange={(e) => set("fontSize")(Number(e.target.value))} className="flex-1 accent-coral-700" />
            <NumberField label="글자 크기(px)" value={element.fontSize} min={8} max={400} onChange={set("fontSize")} className="w-24 [&>span]:sr-only" />
          </span>
        </div>
      )}

      <div className="space-y-3">
        <ColorField label={isText ? "글자색" : "채우기 색"} value={element.color} onChange={set("color")} />
        <Percent label="불투명도" value={element.opacity} min={0.05} onChange={set("opacity")} />
      </div>

      {isText ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={element.align === a}
                onClick={() => onChange({ align: a })}
                className={`rounded-lg border px-3 py-1.5 text-sm ${element.align === a ? "border-accent font-semibold" : "border-border-input"}`}
              >
                {a === "left" ? "왼쪽" : a === "center" ? "가운데" : "오른쪽"}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={element.bold} onChange={(e) => onChange({ bold: e.target.checked })} className="size-4 accent-coral-700" /> 굵게
            </label>
          </div>
          {element.h > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="세로 정렬">
              {(["top", "middle", "bottom"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={element.valign === a}
                  onClick={() => onChange({ valign: a })}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${element.valign === a ? "border-accent font-semibold" : "border-border-input"}`}
                >
                  {a === "top" ? "위" : a === "middle" ? "세로 가운데" : "아래"}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <label className={LABEL}>
          <span>
            모서리 둥글기 <span className="tabular-nums text-muted">{element.radius}px</span>
          </span>
          <input type="range" min={0} max={120} value={element.radius} onChange={(e) => set("radius")(Number(e.target.value))} className="w-full accent-coral-700" />
        </label>
      )}

      {/* 그림자 */}
      <fieldset className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
        <legend className="px-1">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={element.shadow} onChange={(e) => onChange({ shadow: e.target.checked })} className="size-4 accent-coral-700" /> 그림자
          </label>
        </legend>
        {element.shadow && (
          <>
            <div className="space-y-3">
              <ColorField label="그림자 색" value={element.shadowColor} onChange={set("shadowColor")} />
              <Percent label="그림자 불투명도" value={element.shadowOpacity} onChange={set("shadowOpacity")} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="흐림" value={element.shadowBlur} min={0} max={200} onChange={set("shadowBlur")} />
              <NumberField label="가로 거리" value={element.shadowX} min={-200} max={200} onChange={set("shadowX")} />
              <NumberField label="세로 거리(깊이)" value={element.shadowY} min={-200} max={200} onChange={set("shadowY")} />
            </div>
          </>
        )}
      </fieldset>

      {onLayer && (
        <div className="space-y-1">
          <span className="block text-sm font-medium">레이어 순서</span>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" className={SMALL_BTN} onClick={() => onLayer("front")}>
              맨 앞으로
            </button>
            <button type="button" className={SMALL_BTN} onClick={() => onLayer("forward")}>
              앞으로
            </button>
            <button type="button" className={SMALL_BTN} onClick={() => onLayer("backward")}>
              뒤로
            </button>
            <button type="button" className={SMALL_BTN} onClick={() => onLayer("back")}>
              맨 뒤로
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
