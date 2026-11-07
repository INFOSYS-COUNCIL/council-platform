import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { TASK_CREATE_ROLES } from "@/lib/tasks/labels";

export const metadata: Metadata = {
  title: "업무 만들기 | 학생회 운영 플랫폼",
};

// 빈 경로. 3주차 업무 생성 Issue에서 채운다
// (기획서 부록 C.3: 제목, 설명, 담당 국, 담당자, 우선순위, 시작·마감일, 공개 모드).
export default function NewTaskPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="업무 만들기" />
      <Suspense fallback={<p>불러오는 중…</p>}>
        <NewTaskContent />
      </Suspense>
    </div>
  );
}

async function NewTaskContent() {
  await requireMember("/tasks/new", TASK_CREATE_ROLES);

  return (
    <EmptyState
      title="아직 준비 중입니다"
      description="국장과 회장단이 업무를 만드는 폼이 여기에 표시됩니다."
    />
  );
}
