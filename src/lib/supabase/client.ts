import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

// 브라우저(Client Component)에서 쓰는 Supabase 클라이언트.
// Publishable Key만 사용한다. Secret/Service Role Key는 절대 여기 넣지 않는다.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
