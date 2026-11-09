import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "업무 | 학생회 운영 플랫폼",
};

// 빈 경로. 3주차 업무 목록 Issue에서 채운다
// (기획서 부록 C.3: 탭 내 업무·소속 국 업무·공유받은 업무, 상태·마감 필터, 기한 초과·담당자 비활성 표시).
export default function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="업무" />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <TasksContent />
      </Suspense>
    </div>
  );
}

async function TasksContent() {
  await requireMember("/tasks");

  return (
    <EmptyState
      title="아직 준비 중입니다"
      description="내 업무, 소속 국 업무, 공유받은 업무가 여기에 표시됩니다."
    />
  );
}
