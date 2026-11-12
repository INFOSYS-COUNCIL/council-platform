import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { MemberRole } from "@/lib/auth/roles";
import type { Database } from "@/lib/supabase/database.types";

export type ChartPerson = { name: string; role: MemberRole; position: string | null };
export type ChartGroup = { title: string; people: ChartPerson[] };

// 공개 조직도(council_org_chart). 회장단 묶음을 맨 앞에, 그다음 국 순서. 업무는 넣지 않는다.
export function groupOrgChart(
  rows: { name: string; role: MemberRole; department_name: string | null; position_name: string | null }[],
): { executives: ChartPerson[]; departments: ChartGroup[] } {
  const person = (r: (typeof rows)[number]): ChartPerson => ({ name: r.name, role: r.role, position: r.position_name });
  const executives = rows.filter((r) => r.role === "EXECUTIVE").map(person);
  const departments: ChartGroup[] = [];
  for (const r of rows) {
    if (r.role === "EXECUTIVE" || !r.department_name) continue;
    const group = departments.find((g) => g.title === r.department_name);
    if (group) group.people.push(person(r));
    else departments.push({ title: r.department_name, people: [person(r)] });
  }
  return { executives, departments };
}

// 로그인과 상관없이 같은 값이라 쿠키 없이 부른다. 구성원이 바뀌면 바로 보여야 하므로 캐시하지 않는다.
export async function getPublicOrgChart() {
  const supabase = createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase.rpc("council_org_chart");
  if (error) throw new Error("조직도를 불러오지 못했습니다.", { cause: error });
  return groupOrgChart(data);
}
