import "server-only";
import type { ActiveMembership } from "@/lib/auth/session";
import { getTermOrgOptions, type MemberOption } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";

export type FinanceRole = "EXECUTIVE" | "DIRECTOR" | "MEMBER";

// 이 기수의 재무 담당 부서와 내 재무 역할(DB의 private.finance_role과 같은 규칙. 표시용이며 DB가 다시 검사한다)
export async function getFinanceContext(membership: ActiveMembership): Promise<{
  department: { id: string; name: string } | null;
  role: FinanceRole | null;
  members: MemberOption[];
}> {
  const supabase = await createClient();
  const [{ data: department }, org] = await Promise.all([
    supabase.from("departments").select("id, name").eq("term_id", membership.termId).eq("is_finance", true).eq("is_active", true).maybeSingle(),
    getTermOrgOptions(membership.termId),
  ]);
  const role: FinanceRole | null =
    membership.role === "EXECUTIVE"
      ? "EXECUTIVE"
      : department && membership.departmentId === department.id
        ? (membership.role as FinanceRole)
        : null;
  return { department: department ?? null, role, members: department ? org.members.filter((m) => m.departmentId === department.id) : [] };
}
