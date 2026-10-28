import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 매 요청마다 만료된 인증 토큰을 갱신해 쿠키에 다시 써 준다.
// 화면 접근 제어는 여기서 하지 않는다. 실제 권한은 DB(RLS)와 서버 코드에서 검사한다.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          // 인증 쿠키가 담긴 응답이 CDN에 캐시되지 않게 한다.
          Object.entries(headers).forEach(([key, value]) =>
            response.headers.set(key, value),
          );
        },
      },
    },
  );

  // createServerClient와 이 호출 사이에 다른 코드를 넣지 않는다.
  // getClaims()가 JWT를 검증하면서 필요하면 토큰을 갱신한다.
  await supabase.auth.getClaims();

  return response;
}
