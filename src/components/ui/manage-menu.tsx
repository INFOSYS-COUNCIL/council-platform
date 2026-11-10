"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// 만든 항목(바로가기·템플릿·부서·일정 등) 옆의 ⋯ "관리" 버튼.
// 누르면 버튼 바로 옆에 작은 메뉴가 뜨고, 할 일(수정·삭제 등)을 고르면 그 폼이 창으로 열린다.
// 메뉴는 화면 기준(fixed)으로 띄워 가로 스크롤 표 등에 잘리지 않게 한다. 바깥 클릭·Esc·스크롤로 닫힌다.
// 폼은 서버 페이지에서 만들어 content로 넘긴다(ActionForm 등).
export type ManageItem = { key: string; label: string; danger?: boolean; content: ReactNode };

const MENU_WIDTH = 176; // w-44

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [menuAt, setMenuAt] = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const current = items.find((item) => item.key === selected);

  useEffect(() => {
    if (!menuAt) return;
    menuRef.current?.querySelector("button")?.focus();
    const close = () => setMenuAt(null);
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [menuAt]);

  if (items.length === 0) return null;

  const openDialog = (key: string) => {
    setMenuAt(null);
    setSelected(key);
    dialogRef.current?.showModal();
  };

  const toggleMenu = () => {
    if (items.length === 1) return openDialog(items[0].key);
    if (menuAt) return setMenuAt(null);
    const r = buttonRef.current!.getBoundingClientRect();
    // 버튼 오른쪽 끝에 맞추되 화면 밖으로 나가지 않게, 아래 공간이 모자라면 위로 연다
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const below = window.innerHeight - r.bottom > items.length * 40 + 16;
    setMenuAt(below ? { top: r.bottom + 4, left } : { bottom: window.innerHeight - r.top + 4, left });
  };

  const moveFocus = (step: number) => {
    const buttons = [...(menuRef.current?.querySelectorAll("button") ?? [])];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(i + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        aria-haspopup={items.length === 1 ? "dialog" : "menu"}
        aria-expanded={items.length === 1 ? undefined : menuAt !== null}
        aria-controls={menuAt ? `${id}-menu` : undefined}
        aria-label={`${subtitle ?? title} 관리`}
        title="관리"
        className="grid size-8 shrink-0 place-items-center rounded-md text-lg leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {menuAt && (
        <ul
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          aria-label={`${subtitle ?? title} 관리`}
          style={{ position: "fixed", ...menuAt, width: MENU_WIDTH }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setMenuAt(null);
              buttonRef.current?.focus();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              moveFocus(1);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              moveFocus(-1);
            } else if (e.key === "Tab") {
              setMenuAt(null);
            }
          }}
          className="z-50 rounded-lg border border-zinc-200 bg-surface p-1 shadow-lg dark:border-zinc-700"
        >
          {items.map((item) => (
            <li key={item.key} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => openDialog(item.key)}
                className={`block w-full rounded-md px-3 py-1.5 text-left text-sm hover:bg-zinc-100 focus-visible:bg-zinc-100 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 ${
                  item.danger ? "text-red-700 dark:text-red-400" : ""
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        onClose={() => buttonRef.current?.focus()}
        className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-surface p-5 text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="text-base font-semibold">
              {current?.label ?? title}
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
        {current?.content}
      </dialog>
    </>
  );
}
