"use server";

import { updateTag } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { SITE_SETTINGS_TAG } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

const ROUTE = ADMIN_ROUTES.settings;

export async function saveCouncilName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const name = String(formData.get("council_name") ?? "").trim();
  if (name.length < 1 || name.length > 30) return actionFailure("학생회 이름은 1~30자로 입력해 주세요.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_council_name", { p_name: name });
  if (error) return actionFailure(rpcErrorMessage(error));
  updateTag(SITE_SETTINGS_TAG);
  return actionSuccess(`이제 "${name} 운영 플랫폼"으로 보입니다.`);
}
