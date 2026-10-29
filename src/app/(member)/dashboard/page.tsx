import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "대시보드 | 학생회 운영 플랫폼",
};

// 빈 경로. 위젯은 6주차 대시보드 Issue에서 채운다(기획서 부록 C.3).
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="대시보드" />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

async function DashboardContent() {
  await requireMember("/dashboard");

  return (
    <EmptyState
      title="아직 준비 중입니다"
      description="내 업무, 이번 주 일정, 진행 중인 행사가 여기에 표시됩니다."
    />
  );
}
