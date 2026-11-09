"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./button";

// 만든 항목(바로가기·템플릿·부서·일정 등) 옆의 ⋯ "관리" 버튼.
// 누르면 화면 가운데 창이 열리고, 할 일(수정·삭제 등)을 고르면 그 폼이 창 안에 나온다.
// 폼은 서버 페이지에서 만들어 content로 넘긴다(ActionForm 등). Esc나 ✕로 닫는다.
export type ManageItem = { key: string; label: string; danger?: boolean; content: ReactNode };

export function ManageMenu({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: ManageItem[];
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const current = items.find((item) => item.key === selected);
  if (items.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSelected(items.length === 1 ? items[0].key : null);
          dialogRef.current?.showModal();
        }}
        aria-haspopup="dialog"
        aria-label={`${subtitle ?? title} 관리`}
        title="관리"
        className="grid size-8 shrink-0 place-items-center rounded-md text-lg leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-surface p-5 text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-base font-semibold">
              {current ? current.label : title}
            </h2>
            {subtitle && <p className="break-all text-sm text-zinc-600 dark:text-zinc-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="닫기"
            className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {current ? (
          <div className="space-y-4">
            {current.content}
            {items.length > 1 && (
              <Button variant="secondary" onClick={() => setSelected(null)}>
                ← 다른 작업 고르기
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setSelected(item.key)}
                  className={`block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800 ${
                    item.danger ? "text-red-700 dark:text-red-400" : ""
                  }`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </dialog>
    </>
  );
}
