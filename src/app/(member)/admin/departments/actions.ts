"use server";

import { refresh } from "next/cache";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";

const ROUTE = ADMIN_ROUTES.departments;
function fields(data: FormData) {
  const name = String(data.get("name") ?? "").trim();
  const raw = String(data.get("sortOrder") ?? "");
  const sortOrder = Number(raw);
  if (!name) return { error: actionFailure("입력값을 확인해 주세요.", { name: "이름을 입력해 주세요." }) };
  if (!raw || !Number.isSafeInteger(sortOrder)) return { error: actionFailure("순서는 정수로 입력해 주세요.") };
  return { name, sortOrder };
}

export async function createItem(_previous: ActionState, data: FormData): Promise<ActionState> {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const value = fields(data);
  if (value.error) return value.error;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_department", { p_term_id: membership.termId, p_name: value.name!, p_sort_order: value.sortOrder! });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("부서를 추가했습니다.");
}

export async function updateItem(_previous: ActionState, data: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const value = fields(data);
  if (value.error) return value.error;
  const id = String(data.get("id") ?? "");
  if (!id) return actionFailure("대상을 확인해 주세요.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_department", { p_department_id: id, p_name: value.name!, p_sort_order: value.sortOrder! });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("부서를 변경했습니다.");
}

export async function setItemActive(_previous: ActionState, data: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const id = String(data.get("id") ?? "");
  const active = String(data.get("active") ?? "");
  if (!id || !["true", "false"].includes(active)) return actionFailure("요청을 확인해 주세요.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_department_active", { p_department_id: id, p_active: active === "true" });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(active === "true" ? "부서를 다시 사용합니다." : "부서를 비활성화했습니다.");
}
