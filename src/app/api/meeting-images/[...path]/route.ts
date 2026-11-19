import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 회의록 이미지 주소. 본문에는 이 고정 주소를 저장하고, 열 때마다 저장소 RLS(그 회의록을 볼 수 있는 사람)를 거쳐
// 잠깐 쓰는 서명 주소로 보낸다. 볼 수 없으면 404.
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const path = (await params).path.join("/");
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("meeting-images").createSignedUrl(path, 300);
  if (error || !data) return new NextResponse("이미지를 찾을 수 없습니다.", { status: 404 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, max-age=240" } });
}
