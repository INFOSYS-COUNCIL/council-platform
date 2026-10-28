import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";

// Server Component · Server Action · Route Handler에서 쓰는 Supabase 클라이언트.
// 요청마다 새로 만든다. 권한 판단은 getSession()이 아니라 getClaims()/getUser()로 한다.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component에서는 쿠키를 쓸 수 없다.
            // 세션 갱신은 proxy.ts가 맡으므로 여기서는 무시해도 된다.
          }
        },
      },
    },
  );
}
