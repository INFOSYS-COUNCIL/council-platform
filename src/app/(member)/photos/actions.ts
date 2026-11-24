"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { actionFailure, rpcErrorMessage, type ActionState } from "@/lib/actions/result";
import { requireMember } from "@/lib/auth/session";
import { PHOTO_BUCKET, PHOTO_MANAGER_ROLES, UUID_PATTERN, photoImageUrls } from "@/lib/photos/content";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

export async function savePhotoPost(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember("/photos/new", PHOTO_MANAGER_ROLES);
  const id = String(form.get("postId") ?? "");
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const revision = Number(form.get("revision"));
  const coverUrl = String(form.get("coverUrl") ?? "");
  const raw = String(form.get("body") ?? "");

  if (!UUID_PATTERN.test(id) || !Number.isInteger(revision) || revision < 0) {
    return actionFailure("게시물 정보를 확인해 주세요.");
  }
  if (!title || title.length > 120 || description.length > 1000) {
    return actionFailure("입력 내용을 확인해 주세요.", {
      ...(!title || title.length > 120 ? { title: "제목은 1~120자로 입력해 주세요." } : {}),
      ...(description.length > 1000 ? { description: "설명은 1000자까지 입력해 주세요." } : {}),
    });
  }
  if (new TextEncoder().encode(raw).length > 524288) return actionFailure("본문이 너무 큽니다.");
  let body: Json;
  try {
    body = JSON.parse(raw);
  } catch {
    return actionFailure("본문을 확인해 주세요.");
  }
  if (!Array.isArray(body)) return actionFailure("본문을 확인해 주세요.");

  if (coverUrl && !photoImageUrls(body).includes(coverUrl)) {
    return actionFailure("본문에 포함된 사진을 썸네일로 선택해 주세요.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_photo_post", {
    p_post_id: id, p_title: title, p_description: description,
    p_body: body, p_expected_revision: revision, p_cover_url: coverUrl || undefined,
  });
  if (error) return actionFailure(rpcErrorMessage(error));
  refresh();
  redirect(`/photos/${id}`);
}

export async function deletePhotoPost(_previous: ActionState, form: FormData): Promise<ActionState> {
  await requireMember("/photos", PHOTO_MANAGER_ROLES);
  const id = String(form.get("postId") ?? "");
  if (!UUID_PATTERN.test(id)) return actionFailure("게시물 정보를 확인해 주세요.");
  const supabase = await createClient();
  const { data: images, error: imagesError } = await supabase.from("photo_images")
    .select("object_path").eq("post_id", id);
  if (imagesError) return actionFailure("삭제할 사진을 확인하지 못했습니다. 다시 시도해 주세요.");
  const { error } = await supabase.rpc("delete_photo_post", { p_post_id: id });
  if (error) return actionFailure(rpcErrorMessage(error));
  // 접근 차단을 먼저 확정한다. 저장소 정리에 실패해도 삭제된 사진이 공개되지 않는다.
  if (images.length) {
    const { error: cleanupError } = await supabase.storage.from(PHOTO_BUCKET)
      .remove(images.map((image) => image.object_path));
    if (cleanupError) console.warn("삭제된 활동 사진 파일 정리가 필요합니다.");
  }
  refresh();
  redirect("/photos");
}
