"use client";

import { useId, useRef, type ReactNode } from "react";
import { Button } from "./button";

// 상세 화면의 "+ 추가"·"수정" 같은 작은 버튼. 누르면 폼을 창(dialog)으로 연다.
// 화면에는 내용만 두고, 입력 폼은 필요할 때만 꺼내 쓰게 한다. Esc나 ✕로 닫는다.
export function DialogButton({
  label,
  title,
  variant = "secondary",
  children,
}: {
  label: string;
  title?: string;
  variant?: "primary" | "secondary";
  children: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <Button variant={variant} aria-haspopup="dialog" onClick={() => ref.current?.showModal()}>
        {label}
      </Button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-surface p-5 text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 id={`${id}-title`} className="text-base font-semibold">
            {title ?? label.replace(/^\+\s*/, "")}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="닫기"
            className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        {children}
      </dialog>
    </>
  );
}
