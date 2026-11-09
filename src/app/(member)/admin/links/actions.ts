"use server";

import { refresh } from "next/cache";
import { actionFailure, actionSuccess, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const ROUTE = ADMIN_ROUTES.links;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

async function run(rpc: () => PromiseLike<{ error: { code?: string; message?: string } | null }>, message: string) {
  const { error } = await rpc();
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  return actionSuccess(message);
}

export async function createLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const url = text(formData, "url");
  if (!/^https:\/\/\S+$/.test(url)) return actionFailure("https:// 로 시작하는 주소를 입력해 주세요.");
  const supabase = await createClient();
  return run(
    () => supabase.rpc("create_dashboard_link", {
      p_name: text(formData, "name"),
      p_url: url,
      p_description: text(formData, "description"),
      p_sort_order: Number(text(formData, "sort_order")) || 0,
    }),
    "바로가기를 추가했습니다.",
  );
}

export async function toggleLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  return run(
    () => supabase.rpc("set_dashboard_link_active", {
      p_link_id: text(formData, "link_id"),
      p_active: text(formData, "active") === "true",
    }),
    "바로가기를 바꿨습니다.",
  );
}

export async function deleteLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  return run(() => supabase.rpc("delete_dashboard_link", { p_link_id: text(formData, "link_id") }), "바로가기를 지웠습니다.");
}

export async function updateLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember(ROUTE.href, ROUTE.roles);
  const url = text(formData, "url");
  if (!/^https:\/\/\S+$/.test(url)) return actionFailure("https:// 로 시작하는 주소를 입력해 주세요.");
  const supabase = await createClient();
  return run(
    () => supabase.rpc("update_dashboard_link", {
      p_link_id: text(formData, "link_id"),
      p_name: text(formData, "name"),
      p_url: url,
      p_description: text(formData, "description"),
      p_sort_order: Number(text(formData, "sort_order")) || 0,
    }),
    "바로가기를 고쳤습니다.",
  );
}
