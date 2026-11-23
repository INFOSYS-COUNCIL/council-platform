import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { PHOTO_BUCKET, UUID_PATTERN } from "@/lib/photos/content";
import { createClient } from "@/lib/supabase/server";

// 이미지 파일을 여는 진입점. 실제 열람 권한은 비공개 버킷 RLS가 검사한다.
export async function GET(_request: Request, { params }: {
  params: Promise<{ photoId: string; ownerId: string; fileName: string }>;
}) {
  const { photoId, ownerId, fileName } = await params;
  await requireUser(`/photos/${photoId}`);
  if (!UUID_PATTERN.test(photoId) || !UUID_PATTERN.test(ownerId) ||
      !/^[0-9a-f-]{36}\.(png|jpg|webp)$/.test(fileName)) {
    return new NextResponse("사진을 찾을 수 없습니다.", { status: 404 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET)
    .createSignedUrl(`${photoId}/${ownerId}/${fileName}`, 60);
  if (error || !data) return new NextResponse("사진을 찾을 수 없습니다.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
