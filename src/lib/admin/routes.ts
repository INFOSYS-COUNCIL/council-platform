import type { MemberRole } from "@/lib/auth/roles";

// 관리 화면 목록과 들어올 수 있는 Role (기획서 1.3, 부록 C.2·C.3).
// 메뉴 표시와 page의 requireMember()가 같은 값을 쓰도록 여기 한곳에 둔다.
// 메뉴에서 숨기는 것은 편의이고, 실제 권한은 RPC와 RLS가 다시 검사한다.
// group: 관리 메뉴 첫 줄에 보이는 묶음 이름. 같은 묶음의 화면은 둘째 줄 탭으로 오간다.
export const ADMIN_ROUTES = {
  members: {
    href: "/admin/members",
    label: "활동 중인 구성원",
    group: "사용자 관리",
    roles: ["EXECUTIVE", "DIRECTOR"],
  },
  approvedAccounts: {
    href: "/admin/approved-accounts",
    label: "가입 승인 명단",
    group: "사용자 관리",
    roles: ["EXECUTIVE", "DIRECTOR"],
  },
  settings: {
    href: "/admin/settings",
    label: "학생회 이름",
    group: "조직 설정",
    roles: ["EXECUTIVE"],
  },
  departments: {
    href: "/admin/departments",
    label: "부서",
    group: "조직 설정",
    roles: ["EXECUTIVE"],
  },
  positions: {
    href: "/admin/positions",
    label: "직책",
    group: "조직 설정",
    roles: ["EXECUTIVE"],
  },
  links: {
    href: "/admin/links",
    label: "대시보드 바로가기",
    group: "대시보드 바로가기",
    roles: ["EXECUTIVE"],
  },
  templates: {
    href: "/admin/templates",
    label: "회의록 템플릿",
    group: "회의록 템플릿",
    roles: ["EXECUTIVE"],
  },
} as const satisfies Record<
  string,
  { href: string; label: string; group: string; roles: readonly MemberRole[] }
>;

export type AdminRoute = (typeof ADMIN_ROUTES)[keyof typeof ADMIN_ROUTES];

// 관리 메뉴가 하나라도 있는 Role
export const ADMIN_ROLES: readonly MemberRole[] = ["EXECUTIVE", "DIRECTOR"];

// 이 Role이 들어갈 수 있는 관리 화면 (메뉴 순서대로)
export function adminRoutesFor(role: MemberRole): AdminRoute[] {
  return Object.values(ADMIN_ROUTES).filter((route) =>
    (route.roles as readonly MemberRole[]).includes(role),
  );
}
