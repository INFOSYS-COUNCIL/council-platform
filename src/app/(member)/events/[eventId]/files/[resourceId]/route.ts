import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// 행사 자료 내려받기. 자료 행이 보이면(=행사를 볼 수 있으면) 60초짜리 서명 주소로 보낸다.
// download 옵션으로 attachment 응답을 받아 브라우저에서 바로 열리지 않게 한다(기획서 5.3절).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ eventId: string; resourceId: string }> },
) {
  const { eventId, resourceId } = await params;
  await requireUser(`/events/${eventId}`);

  const supabase = await createClient();
  const { data: resource } = await supabase
    .from("event_resources")
    .select("title, storage_path")
    .eq("id", resourceId)
    .eq("event_id", eventId)
    .eq("resource_type", "UPLOAD")
    .maybeSingle();
  if (!resource?.storage_path) notFound();

  const ext = resource.storage_path.split(".").pop();
  const fileName = resource.title.endsWith(`.${ext}`) ? resource.title : `${resource.title}.${ext}`;
  const { data, error } = await supabase.storage
    .from("event-files")
    .createSignedUrl(resource.storage_path, 60, { download: fileName });
  if (error || !data) notFound();

  redirect(data.signedUrl);
}
