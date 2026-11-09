import { Suspense, type ReactNode } from "react";
import { adminRoutesFor } from "@/lib/admin/routes";
import { getActiveMembership } from "@/lib/auth/session";
import { AdminNav } from "./admin-nav";

// 관리 화면 공통 틀(하위 메뉴). 공용 파일이므로 리드가 관리한다.
// 메뉴는 Role에 맞는 화면만 보여 줄 뿐이다. 접근 확인은 각 page의 requireMember()가 한다.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <Suspense fallback={null}>
        <AdminNavLoader />
      </Suspense>
      {children}
    </div>
  );
}

async function AdminNavLoader() {
  const membership = await getActiveMembership();
  if (!membership) return null;

  const routes = adminRoutesFor(membership.role);
  if (routes.length === 0) return null;

  return <AdminNav routes={routes.map(({ href, label, group }) => ({ href, label, group }))} />;
}
