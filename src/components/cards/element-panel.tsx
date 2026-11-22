"use client";

import type { CardElement } from "@/lib/cards/model";

const INPUT = "w-full rounded-lg border border-border-input bg-surface px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LABEL = "block space-y-1 text-sm font-medium";

// 고른 요소의 속성 편집. template: 틀 편집기(이름·고정 여부·지우기까지), 아니면 카드뉴스(글·크기·색·정렬만)
export function ElementPanel({
  element,
  onChange,
  onDelete,
  template,
}: {
  element: CardElement | undefined;
  onChange: (patch: Partial<CardElement>) => void;
  onDelete?: () => void;
  template: boolean;
}) {
  if (!element) {
    return <p className="text-sm text-muted">카드에서 요소를 누르면 여기서 글·크기·색을 바꿀 수 있습니다. 끌어서 옮기고, 오른쪽 아래 파란 점으로 크기를 바꿉니다.</p>;
  }
  const isText = element.kind === "text";
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{element.label}</p>
        {template && onDelete && (
          <button type="button" onClick={onDelete} className="rounded-lg px-2 py-1 text-sm font-medium text-danger hover:bg-danger-bg">
            요소 지우기
          </button>
        )}
      </div>

      {template && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={LABEL}>
            <span>요소 이름</span>
            <input className={INPUT} value={element.label} maxLength={20} onChange={(e) => onChange({ label: e.target.value })} />
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
          <textarea className={`${INPUT} min-h-28`} value={element.text} maxLength={2000} onChange={(e) => onChange({ text: e.target.value })} />
        </label>
      )}

      {isText && (
        <label className={LABEL}>
          <span>
            글자 크기 <span className="tabular-nums text-muted">{element.fontSize}px</span>
          </span>
          <span className="flex items-center gap-2">
            <input type="range" min={12} max={240} value={element.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) })} className="flex-1 accent-coral-700" />
            <input
              type="number"
              min={8}
              max={400}
              value={element.fontSize}
              onChange={(e) => onChange({ fontSize: Math.min(400, Math.max(8, Number(e.target.value) || 8)) })}
              className={`${INPUT} w-20`}
              aria-label="글자 크기(px)"
            />
          </span>
        </label>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className={LABEL}>
          <span>{isText ? "글자색" : "채우기 색"}</span>
          <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="h-10 w-full cursor-pointer rounded-lg border border-border-input bg-surface" />
        </label>
        <label className={LABEL}>
          <span>
            진하기 <span className="tabular-nums text-muted">{Math.round(element.opacity * 100)}%</span>
          </span>
          <input type="range" min={0.1} max={1} step={0.05} value={element.opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} className="w-full accent-coral-700" />
        </label>
      </div>

      {isText ? (
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
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={element.shadow} onChange={(e) => onChange({ shadow: e.target.checked })} className="size-4 accent-coral-700" /> 은은한 그림자
          </label>
        </div>
      ) : (
        <label className={LABEL}>
          <span>
            모서리 둥글기 <span className="tabular-nums text-muted">{element.radius}px</span>
          </span>
          <input type="range" min={0} max={120} value={element.radius} onChange={(e) => onChange({ radius: Number(e.target.value) })} className="w-full accent-coral-700" />
        </label>
      )}

      <p className="text-xs text-muted tabular-nums">
        위치 {element.x}, {element.y} · 폭 {element.w}
        {element.kind === "box" && ` · 높이 ${element.h}`}px
      </p>
    </div>
  );
}
