import Link from "next/link";
import type { ReactNode } from "react";

// 학생회 구성원 화면의 공통 틀(메뉴). 공용 파일이므로 리드가 관리한다.
// 로그인·권한 확인은 여기서 하지 않는다. 레이아웃은 같은 그룹 안에서 이동할 때
// 다시 실행되지 않으므로, 각 page에서 requireMember()를 부른다.
// 새 기능 화면이 생기면 리드가 NAV_ITEMS에 추가한다(아직 없는 주소는 넣지 않는다).
const NAV_ITEMS = [
  { href: "/dashboard", label: "대시보드" },
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
                <Link
                  href={item.href}
                  className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
