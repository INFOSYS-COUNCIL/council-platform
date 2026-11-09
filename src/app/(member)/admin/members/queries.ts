import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// 같은 기수 구성원은 모두 읽을 수 있으므로, 국장은 조회 조건으로 자기 국만 본다(쓰기는 RPC가 다시 검사).
export function readMembers(
  supabase: ServerClient,
  termId: string,
  director: { departmentId: string | null } | null,
) {
  const query = supabase
    .from("memberships")
    .select("id, user_id, role, department_id, position_id, profile:profiles(email, display_name)")
    .eq("term_id", termId)
    .eq("is_active", true);
  if (!director) return query;
  return director.departmentId ? query.eq("department_id", director.departmentId) : query.limit(0);
}
