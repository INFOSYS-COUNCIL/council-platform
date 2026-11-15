"use client";

import { useEffect, useRef, type ReactNode } from "react";

// 첫 화면의 화면 단위 구역 넘기기(3차 QA): 휠을 조금만 굴려도 다음·이전 구역으로 넘어간다.
// CSS scroll-snap만 쓰면 조금 굴렸을 때 가까운(원래) 구역으로 되돌아가므로 휠만 직접 처리한다.
// 화면보다 긴 구역(조직도 등)은 그 안을 다 내려 본 뒤에 넘어간다. 터치·키보드는 브라우저 기본 스크롤과 snap에 맡긴다.
export function SectionPager({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let locked = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // 확대·축소
      if (locked) return e.preventDefault();
      const dir = Math.sign(e.deltaY);
      if (dir === 0 || Math.abs(e.deltaY) < 4) return;
      const sections = [...el.children] as HTMLElement[];
      const top = el.scrollTop;
      const i = sections.reduce((best, s, k) => (Math.abs(s.offsetTop - top) < Math.abs(sections[best].offsetTop - top) ? k : best), 0);
      const current = sections[i];
      // 지금 구역 안에 아직 볼 내용이 남았으면 그대로 스크롤한다
      if (dir > 0 && top + el.clientHeight < current.offsetTop + current.offsetHeight - 2) return;
      if (dir < 0 && top > current.offsetTop + 2) return;
      const target = sections[i + dir];
      if (!target) return;
      e.preventDefault();
      locked = true;
      const to = dir > 0 ? target.offsetTop : Math.max(target.offsetTop, target.offsetTop + target.offsetHeight - el.clientHeight);
      el.scrollTo({ top: to, behavior: reduce ? "auto" : "smooth" });
      setTimeout(() => (locked = false), 800);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <main ref={ref} className={className}>
      {children}
    </main>
  );
}
