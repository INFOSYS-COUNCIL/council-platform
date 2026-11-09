import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ADMIN_ROLES } from "@/lib/admin/routes";
import { getActiveMembership } from "@/lib/auth/session";

// 학생회 구성원 화면의 공통 틀(메뉴). 공용 파일이므로 리드가 관리한다.
// 로그인·권한 확인은 여기서 하지 않는다. 레이아웃은 같은 그룹 안에서 이동할 때
// 다시 실행되지 않으므로, 각 page에서 requireMember()를 부른다.
// 새 기능 화면이 생기면 리드가 NAV_ITEMS에 추가한다(아직 없는 주소는 넣지 않는다).
const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
  { href: "/tasks", label: "업무" },
  { href: "/me", label: "내 계정" },
] as const;

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-zinc-900"
      >
        본문 바로가기
      </a>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav
          aria-label="주 메뉴"
          className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
        >
          <Link href="/dashboard" className="font-bold">
            학생회 운영 플랫폼
          </Link>
          <ul className="flex flex-wrap gap-4 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>{item.label}</NavLink>
              </li>
            ))}
            <Suspense fallback={null}>
              <AdminNavItem />
            </Suspense>
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      {children}
    </Link>
  );
}

// 관리 화면이 있는 Role(회장단·국장)에게만 "관리" 메뉴를 보여 준다.
// 표시용이며, 접근 확인은 각 관리 page의 requireMember()가 한다.
async function AdminNavItem() {
  const membership = await getActiveMembership();
  if (!membership || !ADMIN_ROLES.includes(membership.role)) return null;

  return (
    <li>
      <NavLink href="/admin">관리</NavLink>
    </li>
  );
}
