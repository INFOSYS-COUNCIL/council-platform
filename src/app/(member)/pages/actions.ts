"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { templateState } from "@/lib/meetings/ydoc";
import { PAGE_SCOPES, parseTags, type PageScope } from "@/lib/pages/labels";
import { createClient } from "@/lib/supabase/server";

// 페이지 쓰기. 권한과 값 규칙은 DB 함수(create_page·update_page·delete_page)가 다시 검사한다.
// 본문 저장은 회의록과 같이 브라우저가 save_meeting_update를 바로 부른다.

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function readScope(formData: FormData) {
  const scope = text(formData, "scope") as PageScope;
  return {
    scope,
    valid: PAGE_SCOPES.includes(scope),
    departmentIds: scope === "DEPARTMENTS" ? formData.getAll("department_ids").map(String).filter(Boolean) : [],
    userIds: scope === "USERS" ? formData.getAll("user_ids").map(String).filter(Boolean) : [],
  };
}

export async function createPage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/pages/new");
  const title = text(formData, "title");
  const scope = readScope(formData);
  if (title.length < 1 || title.length > 100) return actionFailure("입력값을 확인해 주세요.", { title: "제목은 1~100자로 입력해 주세요." });
  if (!scope.valid) return actionFailure("입력값을 확인해 주세요.", { scope: "공개 범위를 하나 선택해 주세요." });

  const initial = templateState([]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_page", {
    p_term_id: membership.termId,
    p_title: title,
    p_state: initial.state,
    p_state_vector: initial.vector,
    p_tags: parseTags(text(formData, "tags")),
    p_scope: scope.scope,
    p_department_ids: scope.departmentIds,
    p_user_ids: scope.userIds,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/pages/${data.id}`);
}

// 편집기의 "/페이지": 빈 페이지를 전체 공개로 만들고 id를 돌려준다(편집기가 그 자리에 링크를 넣는다)
export async function createPageFromEditor(title: string): Promise<{ id: string } | { error: string }> {
  const membership = await requireMember("/pages");
  const initial = templateState([]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_page", {
    p_term_id: membership.termId,
    p_title: title.trim().slice(0, 100) || "새 페이지",
    p_state: initial.state,
    p_state_vector: initial.vector,
  });
  if (error) return { error: rpcErrorMessage(error) };
  return { id: data.id };
}

export async function updatePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pageId = text(formData, "page_id");
  await requireMember(`/pages/${pageId}`);
  const scope = readScope(formData);
  if (!scope.valid) return actionFailure("공개 범위를 하나 선택해 주세요.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_page", {
    p_page_id: pageId,
    p_title: text(formData, "title"),
    p_tags: parseTags(text(formData, "tags")),
    p_scope: scope.scope,
    p_department_ids: scope.departmentIds,
    p_user_ids: scope.userIds,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess("페이지 정보를 저장했습니다.");
}

export async function deletePage(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const pageId = text(formData, "page_id");
  await requireMember(`/pages/${pageId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_page", { p_page_id: pageId });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect("/pages");
}
