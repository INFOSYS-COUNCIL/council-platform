import "server-only";
import { photoImageUrl, matchesPhotoSearch } from "./content";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type PhotoListRow = Pick<Database["public"]["Tables"]["photo_posts"]["Row"], "id" | "title" | "description" | "tags" | "created_at"> & {
  photo_images: { object_path: string; position: number }[];
};

export async function getPhotoList(tag?: string, search = "") {
  const supabase = await createClient();
  let query = supabase.from("photo_posts")
    .select("id, title, description, tags, created_at, photo_images(object_path, position)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id");
  if (tag) query = query.contains("tags", [tag]);
  const rows: PhotoListRow[] = [];
  // API의 기본 행 제한으로 오래된 게시물이 페이지에서 누락되지 않도록 나눠 읽는다.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw new Error("과 활동을 불러오지 못했습니다.", { cause: error });
    rows.push(...data);
    if (data.length < 500) break;
  }
  // RLS와 태그 조회로 허용된 글만 가져온 뒤, 검색어를 필터 문법 없이 일반 문자열로 비교한다.
  return rows.filter((post) => matchesPhotoSearch(post, search)).map((post) => {
    const cover = post.photo_images.find((image) => image.position === 1);
    return { id: post.id, title: post.title, tags: post.tags, createdAt: post.created_at, coverUrl: cover ? photoImageUrl(cover.object_path) : null };
  });
}

export async function getPhotoPost(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("photo_posts")
    .select("id, title, description, body, revision, tags, photo_images(object_path, position)")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("과 활동을 불러오지 못했습니다.", { cause: error });
  if (!data) return null;
  const cover = data.photo_images.find((image) => image.position === 1);
  return { ...data, coverUrl: cover ? photoImageUrl(cover.object_path) : null };
}
