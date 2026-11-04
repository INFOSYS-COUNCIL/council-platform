import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { adminRoutesFor } from "@/lib/admin/routes";
import { getActiveMembership } from "@/lib/auth/session";

// 관리 화면 공통 틀(하위 메뉴). 공용 파일이므로 리드가 관리한다.
// 메뉴는 Role에 맞는 화면만 보여 줄 뿐이다. 접근 확인은 각 page의 requireMember()가 한다.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AdminNav />
      </Suspense>
      {children}
    </div>
  );
}

async function AdminNav() {
  const membership = await getActiveMembership();
  if (!membership) return null;

  const routes = adminRoutesFor(membership.role);
  if (routes.length === 0) return null;

  return (
    <nav aria-label="관리 메뉴">
      <ul className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 text-sm dark:border-zinc-800">
        {routes.map((route) => (
          <li key={route.href}>
            <Link
              href={route.href}
              className="block rounded-md px-3 py-1.5 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800"
            >
              {route.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
