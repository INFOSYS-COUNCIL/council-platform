import "server-only";
import { photoImageUrl } from "./content";
import { createClient } from "@/lib/supabase/server";

export async function getPhotoList() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("photo_posts")
    .select("id, title, photo_images(object_path, position)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id");
  if (error) throw new Error("활동 사진을 불러오지 못했습니다.", { cause: error });
  return data.map((post) => {
    const cover = post.photo_images.find((image) => image.position === 1);
    return { id: post.id, title: post.title, coverUrl: cover ? photoImageUrl(cover.object_path) : null };
  });
}

export async function getPhotoPost(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("photo_posts")
    .select("id, title, description, body, revision, photo_images(object_path, position)")
    .eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw new Error("활동 사진을 불러오지 못했습니다.", { cause: error });
  if (!data) return null;
  const cover = data.photo_images.find((image) => image.position === 1);
  return { ...data, coverUrl: cover ? photoImageUrl(cover.object_path) : null };
}
