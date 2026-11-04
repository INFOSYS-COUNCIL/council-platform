import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ADMIN_ROLES, adminRoutesFor } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";

// /admin은 Role이 들어갈 수 있는 첫 관리 화면으로 보낸다.
export default function AdminIndexPage() {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <RedirectToFirstRoute />
    </Suspense>
  );
}

async function RedirectToFirstRoute(): Promise<never> {
  const membership = await requireMember("/admin", ADMIN_ROLES);
  redirect(adminRoutesFor(membership.role)[0].href);
}
