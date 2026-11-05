import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "직책 | 학생회 운영 플랫폼",
};

const ROUTE = ADMIN_ROUTES.positions;

// 빈 경로. 2주차 Issue에서 채운다(기획서 부록 C.3: 추가·이름 변경·순서 변경·비활성화(D-17)).
export default function PositionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="직책" />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <PositionsContent />
      </Suspense>
    </div>
  );
}

async function PositionsContent() {
  await requireMember(ROUTE.href, ROUTE.roles);

  return (
    <EmptyState
      title="아직 준비 중입니다"
      description="직책 추가, 이름·순서 변경, 비활성화가 여기에 표시됩니다."
    />
  );
}
