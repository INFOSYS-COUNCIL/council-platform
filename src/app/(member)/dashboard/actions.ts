"use server";

import { createClient } from "@/lib/supabase/server";

// 알림 창을 열면 내 알림을 모두 읽음으로 표시한다(DB 함수가 본인 알림만 바꾼다)
export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
}
