"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AdminRoute } from "@/lib/admin/routes";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

// 관리 메뉴: 첫 줄은 묶음(사용자 관리·조직 설정 등), 둘째 줄은 지금 묶음 안의 세부 화면.
export function AdminNav({ routes }: { routes: Pick<AdminRoute, "href" | "label" | "group">[] }) {
  const pathname = usePathname();
  const groups = [...new Set(routes.map((r) => r.group))];
  const current = routes.find((r) => pathname === r.href || pathname.startsWith(`${r.href}/`));
  const siblings = routes.filter((r) => r.group === current?.group);

  return (
    <nav aria-label="관리 메뉴" className="space-y-3">
      <ul className="flex flex-wrap gap-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {groups.map((group) => {
          const first = routes.find((r) => r.group === group)!;
          const active = current?.group === group;
          return (
            <li key={group}>
              <Link
                href={first.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-md px-3 py-1.5 text-sm font-medium ${FOCUS} ${
                  active
                    ? "bg-coral-100 text-coral-900 dark:bg-coral-900/40 dark:text-coral-200"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {group}
              </Link>
            </li>
          );
        })}
      </ul>
      {siblings.length > 1 && (
        <ul className="flex flex-wrap gap-1" aria-label={`${current!.group} 세부 메뉴`}>
          {siblings.map((r) => {
            const active = r.href === current!.href;
            return (
              <li key={r.href}>
                <Link
                  href={r.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-full border px-3 py-1 text-sm ${FOCUS} ${
                    active
                      ? "border-coral-700 font-medium text-coral-800 dark:border-coral-400 dark:text-coral-300"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {r.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
