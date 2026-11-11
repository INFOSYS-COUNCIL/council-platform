"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";

// 구성원 화면의 왼쪽 사이드바(Linear 방식). 넓은 화면에서는 항상 보이고,
// 좁은 화면(375px 등)에서는 위쪽 막대의 "메뉴" 버튼으로 연다.
// 넓은 화면에서는 접기 버튼으로 아이콘만 남길 수 있고, 이 선택은 브라우저에 기억한다.
// 어떤 메뉴를 보여 줄지는 서버(layout.tsx)가 정해서 넘긴다. 여기서는 표시만 한다.

export type NavIcon =
  | "home"
  | "tasks"
  | "calendar"
  | "doc"
  | "flag"
  | "inbox"
  | "chat"
  | "settings"
  | "user"
  | "collapse"
  | "expand";

export type NavGroup = {
  label: string;
  items: readonly { href: string; label: string; icon: NavIcon }[];
};

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function isCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const COLLAPSED_KEY = "sidebar-collapsed";
const COLLAPSED_EVENT = "sidebar-collapsed-change";

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(COLLAPSED_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(COLLAPSED_EVENT, onChange);
  };
}

// 저장소를 못 쓰는 환경에서는 펼친 상태로 둔다.
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function Sidebar({
  groups,
  footer,
  roleLabel,
  platformName,
}: {
  groups: readonly NavGroup[];
  footer: NavGroup["items"];
  roleLabel?: string;
  platformName: string;
}) {
  const pathname = usePathname();
  // 메뉴를 연 주소를 기억한다. 다른 화면으로 이동하면 주소가 달라져 저절로 닫힌다.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);
  const toggleCollapsed = () => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1");
    } catch {}
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
  };
  // 접혔을 때 넓은 화면에서만 글자를 숨긴다(스크린리더는 계속 읽는다).
  const hideWide = collapsed ? "md:sr-only" : "";

  return (
    // 좁은 화면: 위쪽 고정 막대라 내용 위에 쌓는다(z-30). 넓은 화면: 쌓지 않아 회의록 편집기 메뉴가 사이드바 위로 보인다.
    <aside
      className={`sticky top-0 z-30 shrink-0 border-b md:z-auto border-zinc-200 bg-sidebar/90 backdrop-blur md:h-screen md:border-r md:border-b-0 md:transition-[width] dark:border-zinc-800 ${collapsed ? "md:w-16" : "md:w-60"}`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) setOpenedAt(null);
      }}
    >
      {/* 접기 버튼: 사이드바 오른쪽 테두리 밖, 세로 가운데(넓은 화면만) */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="member-nav"
        aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
        className={`absolute top-1/2 -right-9 z-10 -translate-y-1/2 hidden size-7 place-items-center rounded-full border border-zinc-300 bg-surface text-zinc-600 shadow-sm hover:text-zinc-950 md:grid dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-50 ${FOCUS}`}
      >
        <Icon name={collapsed ? "expand" : "collapse"} />
      </button>
      <div className="flex h-14 items-center justify-between gap-2 px-4 md:h-auto md:px-3 md:pt-4 md:pb-2">
        <Link
          href="/dashboard"
          className={`flex min-w-0 items-center gap-2.5 rounded-md px-1 py-1 ${FOCUS}`}
        >
          <span
            aria-hidden="true"
            className="bg-coral-gradient grid size-7 shrink-0 place-items-center rounded-md text-xs font-bold text-zinc-950"
          >
            IS
          </span>
          <span className={`min-w-0 ${hideWide}`}>
            <span className="block truncate text-sm font-semibold">{platformName}</span>
            {roleLabel && (
              <span className="block truncate text-xs text-zinc-600 dark:text-zinc-400">
                정보시스템학과 · {roleLabel}
              </span>
            )}
          </span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="member-nav"
          onClick={() => setOpenedAt(open ? null : pathname)}
          className={`inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-2.5 py-1.5 text-sm font-medium hover:bg-zinc-100 md:hidden dark:border-zinc-700 dark:hover:bg-zinc-800 ${FOCUS}`}
        >
          <Icon name={open ? "close" : "menu"} />
          메뉴
        </button>
      </div>

      <nav
        id="member-nav"
        aria-label="주 메뉴"
        className={`${open ? "flex" : "hidden"} max-h-[calc(100dvh-3.5rem)] flex-col justify-between gap-4 overflow-y-auto border-t border-zinc-200 px-3 pt-3 pb-4 md:flex md:h-[calc(100vh-4.5rem)] md:max-h-none md:border-t-0 md:pt-2 dark:border-zinc-800`}
      >
        <div className="space-y-5">
          {groups.map((group) => (
            <div key={group.label}>
              <p className={`px-2 pb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 ${hideWide}`}>
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink item={item} current={isCurrent(pathname, item.href)} collapsed={collapsed} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <ul className="space-y-0.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          {footer.map((item) => (
            <li key={item.href}>
              <NavLink item={item} current={isCurrent(pathname, item.href)} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

// 메뉴를 불러오는 동안 보이는 자리(주소를 읽지 않으므로 미리 렌더링할 수 있다).
export function SidebarFallback() {
  return (
    // 좁은 화면: 위쪽 고정 막대라 내용 위에 쌓는다(z-30). 넓은 화면: 쌓지 않아 회의록 편집기 메뉴가 사이드바 위로 보인다.
    <aside
      aria-hidden="true"
      className="h-14 shrink-0 border-b border-zinc-200 bg-sidebar md:h-screen md:w-60 md:border-r md:border-b-0 dark:border-zinc-800"
    >
      <div className="flex items-center gap-2.5 px-4 py-3.5 md:px-4 md:pt-5">
        <span className="bg-coral-gradient size-7 rounded-md" />
        <span className="h-4 w-28 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
    </aside>
  );
}

function NavLink({
  item,
  current,
  collapsed,
}: {
  item: NavGroup["items"][number];
  current: boolean;
  collapsed: boolean;
}) {
  return (
    // prefetch={false}: 좁은 화면에서 메뉴를 열면 링크 10개가 한꺼번에 보이며 동시에 미리 불러온다.
    // 로그인 토큰이 만료된 뒤(휴대폰에서 탭을 오래 두었다 다시 연 경우)라면 그 요청들이 같은
    // refresh token으로 동시에 갱신을 시도하고, 실패한 응답이 로그인 쿠키를 지워 로그인 화면으로
    // 튕긴다. 미리 불러오지 않으면 누른 화면 하나만 요청하므로 갱신도 한 번만 일어난다.
    <Link
      href={item.href}
      prefetch={false}
      aria-current={current ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${FOCUS} ${
        current
          ? "bg-white font-medium text-zinc-950 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700"
          : "text-zinc-700 hover:bg-zinc-200/60 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-50"
      }`}
    >
      <span className={current ? "text-coral-700 dark:text-coral-300" : "text-zinc-500 dark:text-zinc-400"}>
        <Icon name={item.icon} />
      </span>
      <span className={collapsed ? "md:sr-only" : ""}>{item.label}</span>
    </Link>
  );
}

// 선 아이콘(16px). 장식용이라 스크린리더에는 읽히지 않는다.
const ICON_PATHS: Record<NavIcon | "menu" | "close", ReactNode> = {
  home: <path d="M3 7.5 8 3.5l5 4V13a.5.5 0 0 1-.5.5H10V10H6v3.5H3.5A.5.5 0 0 1 3 13Z" />,
  tasks: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="m5.75 8 1.5 1.5 3-3" />
    </>
  ),
  calendar: (
    <>
      <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
    </>
  ),
  doc: (
    <>
      <path d="M4 2.5h5l3 3v8a.5.5 0 0 1-.5.5h-7.5a.5.5 0 0 1-.5-.5v-10.5a.5.5 0 0 1 .5-.5Z" />
      <path d="M9 2.5v3h3M5.5 8.5h5M5.5 11h3.5" />
    </>
  ),
  flag: <path d="M3.5 14V2.5M3.5 3h8l-1.75 2.75L11.5 8.5h-8" />,
  inbox: (
    <>
      <path d="M2.5 9 4 3.5h8L13.5 9v3.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1Z" />
      <path d="M2.5 9H6l.5 1.5h3L10 9h3.5" />
    </>
  ),
  chat: <path d="M2.5 4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H6.5l-3 2.5v-2.5h0a1 1 0 0 1-1-1Z" />,
  settings: (
    <>
      <path d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7" />
      <circle cx="11" cy="4.5" r="1.5" />
      <circle cx="5" cy="11.5" r="1.5" />
    </>
  ),
  user: (
    <>
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M3 13.5a5 5 0 0 1 10 0" />
    </>
  ),
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  collapse: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M6 2.5v11M10.5 6 8.5 8l2 2" />
    </>
  ),
  expand: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M6 2.5v11M8.5 6l2 2-2 2" />
    </>
  ),
  close: <path d="m4 4 8 8M12 4l-8 8" />,
};

function Icon({ name }: { name: keyof typeof ICON_PATHS }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
