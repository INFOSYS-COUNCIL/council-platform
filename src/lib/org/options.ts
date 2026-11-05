import "server-only";
import { cache } from "react";
import type { MemberRole } from "@/lib/auth/roles";
import { ROLE_ORDER } from "@/lib/auth/roles";
import type { SelectOption } from "@/components/ui/form-field";
import { createClient } from "@/lib/supabase/server";

// 담당자·관리 책임자·열람 대상 선택 목록에 쓰는 같은 기수의 부서와 활성 구성원.
// 여러 화면이 같은 목록을 쓰므로 한곳에서 조회한다. 읽기 권한은 RLS가 정한다.

export type DepartmentOption = { id: string; name: string };

export type MemberOption = {
  userId: string;
  name: string; // 표시 이름, 없으면 이메일
  role: MemberRole;
  departmentId: string | null;
  departmentName: string | null;
};

export type TermOrgOptions = {
  departments: DepartmentOption[];
  members: MemberOption[];
};

// 한 요청 안에서 여러 번 불러도 한 번만 조회한다.
export const getTermOrgOptions = cache(
  async (termId: string): Promise<TermOrgOptions> => {
    const supabase = await createClient();

    const [departmentsResult, membersResult] = await Promise.all([
      supabase
        .from("departments")
        .select("id, name, sort_order")
        .eq("term_id", termId)
        .eq("is_active", true)
        .order("sort_order")
        .order("name"),
      supabase
        .from("memberships")
        .select(
          "user_id, role, department_id, profile:profiles(display_name, email), department:departments(name, sort_order)",
        )
        .eq("term_id", termId)
        .eq("is_active", true),
    ]);

    if (departmentsResult.error || membersResult.error) {
      throw new Error("부서와 구성원 목록을 불러오지 못했습니다.", {
        cause: departmentsResult.error ?? membersResult.error,
      });
    }

    // 부서 순서 → Role(회장단→국장→국원) → 이름. 회장단(부서 없음)이 맨 앞
    const rows = membersResult.data.map((m) => ({
      member: {
        userId: m.user_id,
        name: m.profile?.display_name?.trim() || m.profile?.email || "이름 없음",
        role: m.role,
        departmentId: m.department_id,
        departmentName: m.department?.name ?? null,
      } satisfies MemberOption,
      sortOrder: m.department?.sort_order ?? -1,
    }));
    rows.sort(
      (a, b) =>
        a.sortOrder - b.sortOrder ||
        ROLE_ORDER.indexOf(a.member.role) - ROLE_ORDER.indexOf(b.member.role) ||
        a.member.name.localeCompare(b.member.name, "ko"),
    );
    const members = rows.map((r) => r.member);

    return {
      departments: departmentsResult.data.map(({ id, name }) => ({ id, name })),
      members,
    };
  },
);

// SelectField에 바로 넘길 수 있는 형태. 예: "재무국 · 홍길동"
export function memberSelectOptions(members: MemberOption[]): SelectOption[] {
  return members.map((m) => ({
    value: m.userId,
    label: m.departmentName ? `${m.departmentName} · ${m.name}` : `회장단 · ${m.name}`,
  }));
}

export function departmentSelectOptions(
  departments: DepartmentOption[],
): SelectOption[] {
  return departments.map((d) => ({ value: d.id, label: d.name }));
}
