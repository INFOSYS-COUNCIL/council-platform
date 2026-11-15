"use server";

import { refresh } from "next/cache";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

// 알림 창을 열면 내 알림을 모두 읽음으로 표시한다(DB 함수가 본인 알림만 바꾼다)
export async function markNotificationsRead(): Promise<void> {
  await requireMember("/dashboard");
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read");
  if (!error) refresh();
}
