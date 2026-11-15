"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { FOCUS_RING } from "@/components/ui/link-button";
import { markNotificationsRead } from "./actions";

export type NotificationItem = { id: string; text: string; href: string | null; when: string; unread: boolean };

// 대시보드 오른쪽 위 알림 버튼(3차 사용 피드백). 새 업무·새 건의 알림의 개수와 내용을 작은 창으로 보여 준다.
// 창을 열면 모두 읽음으로 표시한다. 바깥 클릭·Esc로 닫힌다.
export function NotificationBell({ items, unreadCount }: { items: NotificationItem[]; unreadCount: number }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(unreadCount);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && unread > 0) {
      setUnread(0);
      void markNotificationsRead();
    }
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        className={`relative inline-flex size-10 items-center justify-center rounded-full border border-zinc-200 bg-white shadow-sm hover:border-coral-300 dark:border-zinc-800 dark:bg-zinc-900 ${FOCUS_RING}`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        <span className="sr-only">알림{unread > 0 ? ` (읽지 않은 알림 ${unread}개)` : ""}</span>
        {unread > 0 && (
          <span aria-hidden="true" className="absolute -top-1 -right-1 min-w-5 rounded-full bg-red-600 px-1 text-center text-xs leading-5 font-semibold text-white tabular-nums">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={`${id}-list`}
          className="absolute top-full right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="px-2 py-1 text-sm font-semibold">알림</p>
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-sm text-zinc-600 dark:text-zinc-400">새 알림이 없습니다.</p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {items.map((n) => {
                const body = (
                  <>
                    <span className="flex items-start gap-2 text-sm">
                      {n.unread && <span aria-label="새 알림" className="mt-1.5 size-2 shrink-0 rounded-full bg-coral-500" />}
                      <span className={n.unread ? "font-semibold" : ""}>{n.text}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-600 dark:text-zinc-400">{n.when}</span>
                  </>
                );
                return (
                  <li key={n.id}>
                    {n.href ? (
                      <Link href={n.href} onClick={() => setOpen(false)} className={`block rounded-lg px-2 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                        {body}
                      </Link>
                    ) : (
                      <div className="px-2 py-2">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
