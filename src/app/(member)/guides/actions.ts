"use server";

import { redirect } from "next/navigation";
import { actionFailure, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { templateState } from "@/lib/meetings/ydoc";
import { parseTags } from "@/lib/pages/labels";
import { createClient } from "@/lib/supabase/server";

// 국별 가이드 만들기: 회장단이나 그 국의 국장(DB 함수 create_guide가 검사). 만든 뒤 페이지 편집 화면으로 간다.
export async function createGuide(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/guides");
  const title = String(formData.get("title") ?? "").trim();
  if (title.length < 1 || title.length > 100) return actionFailure("입력값을 확인해 주세요.", { title: "제목은 1~100자로 입력해 주세요." });

  const initial = templateState([]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_guide", {
    p_department_id: String(formData.get("department_id") ?? ""),
    p_title: title,
    p_tags: parseTags(String(formData.get("tags") ?? "")),
    p_state: initial.state,
    p_state_vector: initial.vector,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/pages/${data}`);
}
