import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "승인 명단 | 학생회 운영 플랫폼",
};

const ROUTE = ADMIN_ROUTES.approvedAccounts;

// 빈 경로. 2주차 Issue에서 채운다(기획서 부록 C.3: 목록(이메일·학번·부서·Role·직책·활성화 여부), 일괄 등록(D-18), 활성화 전 수정·취소).
export default function ApprovedAccountsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="승인 명단" />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <ApprovedAccountsContent />
      </Suspense>
    </div>
  );
}

async function ApprovedAccountsContent() {
  await requireMember(ROUTE.href, ROUTE.roles);

  return (
    <EmptyState
      title="아직 준비 중입니다"
      description="승인 명단 목록과 일괄 등록, 활성화 전 수정·취소가 여기에 표시됩니다."
    />
  );
}
