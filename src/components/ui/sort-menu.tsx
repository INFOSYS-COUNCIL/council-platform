"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FOCUS_RING } from "./link-button";

// 목록 정렬 버튼: 누르면 바로 아래에 정렬 방식 목록이 열린다(네이티브 select는 맥에서 위로 열려 쓰지 않는다).
// 바깥 클릭·Esc·선택으로 닫힌다.
export function SortMenu({ options, current }: { options: { value: string; label: string; href: string }[]; current: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const label = options.find((o) => o.value === current)?.label ?? options[0].label;

  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLAnchorElement>("[aria-current]")?.focus();
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        className={`inline-flex h-11 items-center gap-1.5 rounded-lg border border-border-input bg-surface px-3 text-sm ${FOCUS_RING}`}
      >
        <span className="text-muted">정렬</span>
        <span className="font-semibold">{label}</span>
        <span aria-hidden className="text-xs text-muted">
          ▾
        </span>
      </button>
      {open && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-zinc-200 bg-surface p-1 shadow-lg dark:border-zinc-800">
          {options.map((o) => (
            <li key={o.value}>
              <Link
                href={o.href}
                onClick={() => setOpen(false)}
                aria-current={o.value === current ? "true" : undefined}
                className={`flex h-10 items-center justify-between rounded-md px-3 text-sm hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING} ${o.value === current ? "font-semibold" : ""}`}
              >
                {o.label}
                {o.value === current && <span aria-hidden>✓</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
