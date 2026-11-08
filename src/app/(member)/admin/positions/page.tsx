import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { OrgSettings } from "../_org-settings/org-settings";
import { createItem, updateItem, setItemActive } from "./actions";

export const metadata: Metadata = { title: "직책 | 학생회 운영 플랫폼" };
const ROUTE = ADMIN_ROUTES.positions;

export default function Page() {
  return <div className="space-y-6"><PageHeader title="직책" /><Suspense fallback={<p role="status">불러오는 중…</p>}><Content /></Suspense></div>;
}

async function Content() {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const { data, error } = await supabase.from("positions").select("id,name,sort_order,is_active").eq("term_id", membership.termId);
  if (error) return <Alert>직책 목록을 불러오지 못했습니다. 다시 시도해 주세요.</Alert>;
  return <OrgSettings label="직책" items={data ?? []} create={createItem} update={updateItem} setActive={setItemActive} />;
}
