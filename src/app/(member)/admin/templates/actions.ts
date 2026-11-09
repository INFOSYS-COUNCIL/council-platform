"use server";

import { refresh } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import type { Json } from "@/lib/supabase/database.types";
import { templateState } from "@/lib/meetings/ydoc";
import { createClient } from "@/lib/supabase/server";

const ROUTE = ADMIN_ROUTES.templates;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

// Template 저장(새로 만들기·수정). 본문은 BlockNote Block 배열(JSON)이다(기획서 6.7절)
export async function saveTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const name = text(formData, "name");
  if (name.length < 1 || name.length > 50) return actionFailure("이름은 1~50자로 입력해 주세요.");

  let blocks: Json;
  try {
    blocks = JSON.parse(text(formData, "blocks") || "[]");
    if (!Array.isArray(blocks)) throw new Error();
    templateState(blocks); // 회의록을 만들 때 변환할 수 있는지 미리 확인한다
  } catch {
    return actionFailure("템플릿 본문을 읽지 못했습니다. 다시 시도해 주세요.");
  }

  const supabase = await createClient();
  const templateId = text(formData, "template_id");
  const { error } = templateId
    ? await supabase.rpc("update_meeting_template", { p_template_id: templateId, p_name: name, p_blocks: blocks })
    : await supabase.rpc("create_meeting_template", { p_term_id: membership.termId, p_name: name, p_blocks: blocks });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(templateId ? "템플릿을 저장했습니다." : "템플릿을 만들었습니다.");
}

export async function toggleTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_meeting_template_active", {
    p_template_id: text(formData, "template_id"),
    p_active: text(formData, "active") === "true",
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("템플릿 사용 여부를 바꿨습니다.");
}

// 쓴 회의록이 없을 때만 지워진다(DB가 검사). 쓴 적이 있으면 사용 중지를 안내한다.
export async function deleteTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_meeting_template", { p_template_id: text(formData, "template_id") });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("템플릿을 삭제했습니다.");
}
