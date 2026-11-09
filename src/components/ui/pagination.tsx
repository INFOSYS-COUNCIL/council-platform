import Link from "next/link";
import { FOCUS_RING } from "./link-button";

// 목록 쪽 이동 (기획서 부록 C.2: 한 쪽 20개). 한 쪽뿐이면 아무것도 그리지 않는다.
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="쪽 이동" className="flex items-center justify-center gap-4 text-sm">
      {page > 1 && (
        <Link href={hrefFor(page - 1)} className={`rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
          이전
        </Link>
      )}
      <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link href={hrefFor(page + 1)} className={`rounded-md border border-zinc-300 px-2.5 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
          다음
        </Link>
      )}
    </nav>
  );
}

// 탭·필터용 둥근 링크. 지금 고른 것은 aria-current로 알린다.
export function PillLink({ href, current, children }: { href: string; current: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-md px-2.5 py-1 text-sm ${FOCUS_RING} ${
        current
          ? "bg-white font-medium text-zinc-950 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      }`}
    >
      {children}
    </Link>
  );
}

export function pageNumber(raw: string | string[] | undefined): number {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}
