import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cacheTag } from "next/cache";
import type { Database } from "@/lib/supabase/database.types";

export const SITE_SETTINGS_TAG = "site-settings";
const DEFAULT_COUNCIL_NAME = "학생회";

// 회장단이 관리에서 정한 학생회 이름(기본 "학생회"). 로그인과 무관한 공개 값이라
// 쿠키 없이 읽어 캐시하고, 바뀌면 set_council_name 뒤에 updateTag로 다시 읽는다.
export async function getCouncilName(): Promise<string> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  const supabase = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data } = await supabase.from("site_settings").select("council_name").maybeSingle();
  return data?.council_name ?? DEFAULT_COUNCIL_NAME;
}

export async function getPlatformName(): Promise<string> {
  return `${await getCouncilName()} 운영 플랫폼`;
}
