import { NextResponse, type NextRequest } from "next/server";
import { homePathFor } from "@/lib/auth/home";
import { safeNextPath } from "@/lib/auth/redirect";
import { findActiveMembership } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// Google 로그인 뒤 돌아오는 주소.
// code를 세션으로 바꾸고, 승인 명단을 확인해 Membership을 활성화한다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const requestedNext = searchParams.get("next");

  // Auth Hook이 학교 외 계정을 거부하면 error가 붙어서 돌아온다.
  if (searchParams.get("error")) {
    return NextResponse.redirect(`${origin}/login?error=access_denied`);
  }

  const code = searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // 승인 명단에 있으면 Membership이 생기고, 없으면 일반 학생으로 남는다.
  // 실패해도 로그인은 유지하고, /me에서 소속 상태를 보여 준다.
  const { error: activateError } = await supabase.rpc("activate_membership");
  if (activateError) {
    console.error("activate_membership failed", { code: activateError.code });
  }

  // 돌아갈 경로가 없으면 소속에 따라 첫 화면을 정한다(기획서 부록 C.2).
  let next: string;
  if (requestedNext) {
    next = safeNextPath(requestedNext);
  } else {
    const membership = await findActiveMembership(supabase, data.user.id).catch(
      () => null,
    );
    next = homePathFor(membership !== null);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
