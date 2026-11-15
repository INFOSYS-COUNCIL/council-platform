"use client";

import { useEffect, useRef, type ReactNode } from "react";

// CSS snap은 비동기 내용·뷰포트 변화에도 움직이므로 실제 입력이 있을 때만 구역을 넘긴다.
export function sectionTarget(sections: readonly { offsetTop: number; offsetHeight: number }[], top: number, height: number, direction: number, keyboard = false): number | null {
  if (!sections.length) return null;
  const index = Math.max(0, sections.findLastIndex((section) => section.offsetTop <= top + 2));
  const current = sections[index];
  // 한 화면에서 조금 넘친 여백 때문에 몇 픽셀씩만 움직이지 않게 한다.
  const edge = Math.max(2, height * 0.08);
  if (direction > 0 && top + height < current.offsetTop + current.offsetHeight - edge) {
    return keyboard ? Math.min(top + height * 0.85, current.offsetTop + current.offsetHeight - height) : null;
  }
  if (direction < 0 && top > current.offsetTop + edge) {
    return keyboard ? Math.max(current.offsetTop, top - height * 0.85) : null;
  }
  const target = sections[index + direction];
  if (!target) return keyboard ? direction < 0 ? current.offsetTop : Math.max(current.offsetTop, current.offsetTop + current.offsetHeight - height) : null;
  return direction > 0 || target.offsetHeight <= height + edge ? target.offsetTop : target.offsetTop + target.offsetHeight - height;
}

export function SectionPager({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let consumed = false;
    let idle: ReturnType<typeof setTimeout>;
    const move = (direction: number, keyboard = false) => {
      const top = sectionTarget([...el.children] as HTMLElement[], el.scrollTop, el.clientHeight, direction, keyboard);
      if (top === null) return false;
      el.scrollTo({ top, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      return true;
    };

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // 확대·축소
      clearTimeout(idle);
      idle = setTimeout(() => { consumed = false; }, 180);
      if (consumed) return e.preventDefault();
      const dir = Math.sign(e.deltaY);
      if (dir === 0 || Math.abs(e.deltaY) < 4) return;
      if (move(dir)) {
        e.preventDefault();
        consumed = true;
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || !["ArrowUp", "ArrowDown"].includes(e.key)) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select, button, [contenteditable], [role=dialog]")) return;
      e.preventDefault();
      if (!e.repeat) move(e.key === "ArrowDown" ? 1 : -1, true);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(idle);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <main ref={ref} className={className} tabIndex={0}>
      {children}
    </main>
  );
}
