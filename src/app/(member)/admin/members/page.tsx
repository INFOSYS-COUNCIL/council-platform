import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "구성원",
};

const ROUTE = ADMIN_ROUTES.members;

// 빈 경로. 2주차 Issue에서 채운다(기획서 부록 C.3: 목록(이름·부서·Role·직책), 종료 화면, 승격은 회장단만).
export default function MembersPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="구성원" />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <MembersContent />
      </Suspense>
    </div>
  );
}

async function MembersContent() {
  await requireMember(ROUTE.href, ROUTE.roles);

  return (
    <EmptyState
      title="아직 준비 중입니다"
      description="구성원 목록, Role·부서·직책 변경, 소속 종료가 여기에 표시됩니다."
    />
  );
}
