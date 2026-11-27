"use client";

import { useCallback, useEffect, useState } from "react";

// 되돌리기·다시 하기. 같은 key의 바뀜이 1초 안에 이어지면(끌기·글자 입력) 한 번으로 묶는다
type State<T> = { past: T[]; present: T; future: T[]; key: string | null; at: number };

const LIMIT = 100;

export function useUndoable<T>(initial: T) {
  const [s, setS] = useState<State<T>>({ past: [], present: initial, future: [], key: null, at: 0 });

  const set = useCallback((update: (prev: T) => T, key?: string) => {
    setS((cur) => {
      const value = update(cur.present);
      if (Object.is(value, cur.present)) return cur;
      const now = Date.now();
      const merge = !!key && key === cur.key && now - cur.at < 1000;
      return { past: merge ? cur.past : [...cur.past.slice(-LIMIT + 1), cur.present], present: value, future: [], key: key ?? null, at: now };
    });
  }, []);
  const undo = useCallback(() => setS((cur) => (cur.past.length ? { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1], future: [cur.present, ...cur.future], key: null, at: 0 } : cur)), []);
  const redo = useCallback(() => setS((cur) => (cur.future.length ? { past: [...cur.past, cur.present], present: cur.future[0], future: cur.future.slice(1), key: null, at: 0 } : cur)), []);

  return { value: s.present, set, undo, redo, canUndo: s.past.length > 0, canRedo: s.future.length > 0 };
}

// Ctrl(⌘)+Z 되돌리기, Ctrl+Shift+Z·Ctrl+Y 다시 하기. 글 입력 칸 안에서는 브라우저의 글자 되돌리기를 그대로 쓴다
export function useUndoKeys(undo: () => void, redo: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || (t.tagName === "INPUT" && !["checkbox", "radio", "range", "color"].includes((t as HTMLInputElement).type)) || t.tagName === "TEXTAREA")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) undo();
      else if ((k === "z" && e.shiftKey) || k === "y") redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);
}
