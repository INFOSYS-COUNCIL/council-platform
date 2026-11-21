import { NextResponse } from "next/server";
import { fromBytea } from "@/lib/meetings/labels";
import { fetchMeetingState } from "@/lib/meetings/queries";
import { stateSnippet } from "@/lib/meetings/ydoc";
import { getCouncilName } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 페이지 바로가기 미리보기: 제목·위치·첫 글귀. 볼 수 없는 페이지는 RLS가 돌려주지 않아 404
export async function GET(_request: Request, { params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  if (!UUID.test(pageId)) return new NextResponse(null, { status: 404 });
  const supabase = await createClient();
  const { data: page } = await supabase.from("meeting_minutes").select("id, title, kind, guide_department_id").eq("id", pageId).maybeSingle();
  if (!page) return new NextResponse(null, { status: 404 });

  const [council, snippet] = await Promise.all([
    getCouncilName(),
    fetchMeetingState(supabase, pageId)
      .then((s) => stateSnippet(fromBytea(s.state)))
      .catch(() => ""),
  ]);
  const place = page.kind === "MEETING" ? "회의록" : page.guide_department_id ? "가이드라인" : "페이지";
  return NextResponse.json(
    { title: page.title, crumb: `${council} / … / ${place}`, snippet },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
