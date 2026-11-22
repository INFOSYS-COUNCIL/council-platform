"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { CARD_SIZES, defaultLayouts, newSlide, parseLayouts, type CardLayout, type CardSlide } from "@/lib/cards/model";
import { getCouncilName } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

// 카드뉴스 쓰기. 권한과 값 규칙은 DB 함수(save_card_template·save_card_news 등)가 다시 검사한다.

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

// 새 틀: 고른 크기에 기본 장 모양(표지·본문·2단 안내)을 넣어 만들고 틀 편집기로 간다
export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const membership = await requireMember("/cards", ["DIRECTOR", "EXECUTIVE"]);
  const name = text(formData, "name");
  const size = CARD_SIZES[Number(text(formData, "size"))] ?? CARD_SIZES[0];
  if (name.length < 1 || name.length > 60) return actionFailure("입력값을 확인해 주세요.", { name: "이름은 1~60자로 입력해 주세요." });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_card_template", {
    p_id: null as unknown as string,
    p_term_id: membership.termId,
    p_name: name,
    p_width: size.width,
    p_height: size.height,
    p_background_color: "#c9d4f5",
    p_background_path: null as unknown as string,
    p_font_path: null as unknown as string,
    p_layouts: defaultLayouts(size.width, size.height, await getCouncilName()) as unknown as Json,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/cards/templates/${data}`);
}

export type TemplateInput = {
  id: string;
  name: string;
  width: number;
  height: number;
  background_color: string;
  background_path: string | null;
  font_path: string | null;
  layouts: CardLayout[];
};

export async function saveTemplate(input: TemplateInput): Promise<{ error?: string }> {
  await requireMember(`/cards/templates/${input.id}`, ["DIRECTOR", "EXECUTIVE"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_card_template", {
    p_id: input.id,
    p_term_id: null as unknown as string,
    p_name: input.name,
    p_width: input.width,
    p_height: input.height,
    p_background_color: input.background_color,
    p_background_path: input.background_path as string,
    p_font_path: input.font_path as string,
    p_layouts: input.layouts as unknown as Json,
  });
  return error ? { error: rpcErrorMessage(error) } : {};
}

export async function deleteTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/cards", ["DIRECTOR", "EXECUTIVE"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_card_template", { p_id: text(formData, "template_id") });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect("/cards");
}

// 새 카드뉴스: 틀의 첫 장 모양으로 한 장을 넣어 만들고 편집기로 간다
export async function createCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/cards");
  const title = text(formData, "title");
  const templateId = text(formData, "template_id");
  if (title.length < 1 || title.length > 100) return actionFailure("입력값을 확인해 주세요.", { title: "제목은 1~100자로 입력해 주세요." });
  const supabase = await createClient();
  const { data: template } = await supabase.from("card_templates").select("layouts").eq("id", templateId).maybeSingle();
  if (!template) return actionFailure("입력값을 확인해 주세요.", { template_id: "틀을 골라 주세요." });
  const first = parseLayouts(template.layouts)[0];
  const slides: CardSlide[] = first ? [newSlide(first)] : [];
  const { data, error } = await supabase.rpc("save_card_news", {
    p_id: null as unknown as string,
    p_template_id: templateId,
    p_title: title,
    p_slides: slides as unknown as Json,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  redirect(`/cards/${data}`);
}

export async function saveCard(input: { id: string; title: string; slides: CardSlide[] }): Promise<{ error?: string }> {
  await requireMember(`/cards/${input.id}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_card_news", {
    p_id: input.id,
    p_template_id: null as unknown as string,
    p_title: input.title,
    p_slides: input.slides as unknown as Json,
  });
  return error ? { error: rpcErrorMessage(error) } : {};
}

export async function deleteCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireMember("/cards");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_card_news", { p_id: text(formData, "card_id") });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  redirect("/cards");
}
