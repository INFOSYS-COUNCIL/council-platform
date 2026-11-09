import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export async function readOrganisation(supabase: ServerClient, termId: string) {
  const [departments, positions] = await Promise.all([
    supabase.from("departments").select("id, name, sort_order, is_active")
      .eq("term_id", termId).order("sort_order").order("name"),
    supabase.from("positions").select("id, name, is_active")
      .eq("term_id", termId).order("sort_order").order("name"),
  ]);

  if (departments.error || positions.error) return null;
  return { departments: departments.data, positions: positions.data };
}

export function readApprovedAccounts(
  supabase: ServerClient,
  termId: string,
  director: { departmentId: string | null } | null,
) {
  const query = supabase.from("approved_council_accounts")
    .select("id, email, student_no, department_id, role, position_id, activated_at, activated_user_id, is_active")
    .eq("term_id", termId);

  // The separate own-account policy can also expose a director's original approval row.
  if (!director) return query;
  return director.departmentId ? query.eq("department_id", director.departmentId) : query.limit(0);
}
