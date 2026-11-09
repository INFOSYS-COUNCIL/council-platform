"use server";

import { refresh } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLE_ORDER } from "@/lib/auth/roles";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const ROUTE = ADMIN_ROUTES.members;

// Role·부서·직책 변경. 회장단만(RPC가 다시 검사한다).
export async function changeRole(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const role = ROLE_ORDER.find((value) => value === form.get("role"));
  if (!role) return actionFailure("역할을 선택해 주세요.");
  const departmentId = String(form.get("departmentId") ?? "") || undefined;
  if (!departmentId && role !== "EXECUTIVE") {
    return actionFailure("국장·국원은 부서를 선택해 주세요.", { departmentId: "부서를 선택해 주세요." });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("change_member_role", {
    p_membership_id: String(form.get("membershipId") ?? ""),
    p_role: role,
    p_department_id: departmentId,
    p_position_id: String(form.get("positionId") ?? "") || undefined,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("역할·부서·직책을 바꿨습니다.");
}

// 소속 종료. 기록은 남고 권한은 바로 사라진다. 회장단은 전체, 국장은 자기 국 국원만.
export async function endMembership(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  if (form.get("confirm") !== "yes") return actionFailure("종료 대상을 확인해 주세요.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("end_membership", {
    p_membership_id: String(form.get("membershipId") ?? ""),
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("소속을 종료했습니다.");
}
