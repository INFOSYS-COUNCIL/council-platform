import { Suspense, type ReactNode } from "react";
import { ADMIN_ROLES } from "@/lib/admin/routes";
import { getActiveMembership } from "@/lib/auth/session";
import { ROLE_LABELS, type MemberRole } from "@/lib/auth/roles";
import { getPlatformName } from "@/lib/site";
import { Sidebar, SidebarFallback, type NavGroup, type NavIcon } from "./sidebar";

// roles: 이 Role에게만 보인다(없으면 memberOnly만 본다)
type NavItem = { href: string; label: string; icon: NavIcon; memberOnly: boolean; roles?: readonly MemberRole[] };

// 학생회 구성원 화면의 공통 틀(왼쪽 사이드바). 공용 파일이므로 리드가 관리한다.
// 로그인·권한 확인은 여기서 하지 않는다. 레이아웃은 같은 그룹 안에서 이동할 때
// 다시 실행되지 않으므로, 각 page에서 requireMember()를 부른다.
// 새 기능 화면이 생기면 리드가 NAV_GROUPS에 추가한다(아직 없는 주소는 넣지 않는다).
// memberOnly: 학생회 구성원에게만 보인다. 일반 학생은 건의와 내 계정만 쓴다.
const NAV_GROUPS = [
  {
    label: "업무 공간",
    items: [
      { href: "/dashboard", label: "대시보드", icon: "home", memberOnly: true },
      { href: "/tasks", label: "업무", icon: "tasks", memberOnly: true },
      { href: "/team-tasks", label: "업무 현황", icon: "chart", memberOnly: true, roles: ["EXECUTIVE", "DIRECTOR"] },
      { href: "/schedule", label: "일정", icon: "calendar", memberOnly: true },
      { href: "/org", label: "조직도", icon: "org", memberOnly: true },
    ],
  },
  {
    label: "기록",
    items: [
      { href: "/meetings", label: "회의록", icon: "doc", memberOnly: true },
    ],
  },
  {
    label: "건의",
    items: [
      { href: "/council/suggestions", label: "받은 건의 처리", icon: "inbox", memberOnly: true },
      { href: "/suggestions", label: "내 건의", icon: "chat", memberOnly: false },
      { href: "/suggestions/public", label: "모두의 건의", icon: "globe", memberOnly: false },
    ],
  },
] as const satisfies readonly { label: string; items: readonly NavItem[] }[];

export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-zinc-900"
      >
        본문 바로가기
      </a>
      <Suspense fallback={<SidebarFallback />}>
        <MemberSidebar />
      </Suspense>
      {/* 넓은 화면의 오른쪽 빈자리를 채우는 장식(노을 원). 읽히지 않고 눌리지 않는다 */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-y-0 right-0 -z-10 hidden w-[30vw] overflow-hidden xl:block">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-gradient-to-br from-coral-400/35 to-orange-300/20 blur-2xl dark:from-coral-700/20 dark:to-orange-700/10" />
        <div className="absolute top-1/3 -right-40 size-[28rem] rounded-full border-[3rem] border-coral-200/40 dark:border-coral-900/20" />
        <div className="absolute -right-16 bottom-10 size-72 rounded-full bg-gradient-to-tr from-amber-200/40 to-coral-300/30 blur-xl dark:from-amber-900/15 dark:to-coral-800/15" />
        <div className="absolute right-24 bottom-1/3 h-10 w-56 rounded-full bg-white/60 dark:bg-zinc-800/30" />
        <div className="absolute top-40 right-40 h-6 w-40 rounded-full bg-white/50 dark:bg-zinc-800/25" />
      </div>
      <main id="main" className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}

// 메뉴는 표시용이며, 접근 확인은 각 page의 requireMember()·requireUser()가 한다.
// 관리 메뉴는 관리 화면이 있는 Role(회장단·국장)에게만 보인다.
async function MemberSidebar() {
  const [membership, platformName] = await Promise.all([getActiveMembership(), getPlatformName()]);
  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => (membership || !item.memberOnly) && (!("roles" in item) || (membership && (item.roles as readonly MemberRole[]).includes(membership.role))))
      .map(({ href, label, icon }) => ({ href, label, icon })),
  })).filter((group) => group.items.length > 0);

  const footer: NavGroup["items"][number][] = [];
  if (membership && ADMIN_ROLES.includes(membership.role)) {
    footer.push({ href: "/admin", label: "관리", icon: "settings" });
  }
  footer.push({ href: "/me", label: "내 계정", icon: "user" });

  return (
    <Sidebar
      groups={groups}
      footer={footer}
      roleLabel={membership ? ROLE_LABELS[membership.role] : "학생"}
      platformName={platformName}
    />
  );
}
