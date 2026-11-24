import type { Json } from "@/lib/supabase/database.types";

export const PHOTO_BUCKET = "activity-photos";
export const PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024;
export const PHOTO_MAX_COUNT = 20;
export const PHOTO_MANAGER_ROLES = ["EXECUTIVE", "DIRECTOR"] as const;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function photoImageUrl(objectPath: string) {
  const [postId, ...file] = objectPath.split("/");
  return `/photos/${postId}/images/${file.join("/")}`;
}

// BlockNote 배열과 children의 이미지 블록 순서를 같은 방식으로 읽는다.
export function photoImageUrls(body: Json): string[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((block) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return [];
    const props = block.props;
    const url = props && typeof props === "object" && !Array.isArray(props) ? props.url : null;
    const own = block.type === "image" && typeof url === "string" ? [url] : [];
    return [...own, ...photoImageUrls(block.children ?? [])];
  });
}

export function validatePhotoFile(file: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.some((type) => type === file.type)) return "PNG·JPG·WEBP 사진만 올릴 수 있습니다.";
  if (file.size > PHOTO_MAX_BYTES) return "사진은 한 장에 20MB까지 올릴 수 있습니다.";
  return null;
}
