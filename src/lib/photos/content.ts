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

export function parsePhotoTags(input: string): { tags: string[]; error?: string } {
  const tags = [...new Set(input.split(/[\s,#]+/u).filter(Boolean).map((tag) => tag.toLowerCase()))];
  if (tags.length > 10) return { tags: [], error: "해시태그는 최대 10개까지 입력해 주세요." };
  if (tags.some((tag) => [...tag].length > 20 || !/^[\p{L}\p{N}_-]+$/u.test(tag))) {
    return { tags: [], error: "태그는 20자 이하의 글자·숫자·밑줄·하이픈으로 입력해 주세요." };
  }
  return { tags };
}

export function photoTagHref(tag: string, query = "") {
  return `/photos?tag=${encodeURIComponent(tag)}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
}

export function matchesPhotoSearch(
  post: { title: string; description: string; tags: readonly string[] },
  query: string,
): boolean {
  const normalize = (text: string) => text.normalize("NFKC").toLowerCase();
  const terms = normalize(query).split(/\s+/u).map((term) => term.replace(/^#+/u, "")).filter(Boolean);
  const fields = [post.title, post.description, ...post.tags].map(normalize);
  return terms.every((term) => fields.some((field) => field.includes(term)));
}

export const PHOTO_PAGE_SIZE = 15;

export function paginatePhotos<T>(posts: readonly T[], requestedPage: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const validPage = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const page = Math.min(validPage, totalPages);
  return { page, totalPages, total: posts.length, posts: posts.slice((page - 1) * pageSize, page * pageSize) };
}

export function photoPageHref(page: number, tag?: string, search = "") {
  const params = new URLSearchParams();
  if (tag) params.set("tag", tag);
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/photos${query ? `?${query}` : ""}`;
}
