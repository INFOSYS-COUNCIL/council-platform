import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OrgSettings } from "../_org-settings/org-settings";
import { createItem, deleteItem, updateItem, setItemActive } from "./actions";

export const metadata: Metadata = { title: "부서" };
const ROUTE = ADMIN_ROUTES.departments;

export default function Page() {
  return <div className="space-y-6"><PageHeader title="부서" /><Suspense fallback={<p role="status">불러오는 중…</p>}><Content /></Suspense></div>;
}

async function Content() {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").select("id,name,sort_order,is_active").eq("term_id", membership.termId);
  if (error) return <Alert>부서 목록을 불러오지 못했습니다. 다시 시도해 주세요.</Alert>;
  return <OrgSettings label="부서" items={data ?? []} create={createItem} update={updateItem} setActive={setItemActive} remove={deleteItem} />;
}
