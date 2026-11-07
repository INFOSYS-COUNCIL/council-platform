import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { TaskStatusBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "업무 상세 | 학생회 운영 플랫폼",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 골격. 3주차 업무 상세 Issue에서 채운다
// (기획서 부록 C.3: 필드 수정, 상태 변경, 공개 모드·ACL 편집, 보관·복원, 변경 이력).
// 볼 수 없는 업무는 RLS가 행을 돌려주지 않으므로 "찾을 수 없음"으로 보인다.
export default function TaskDetailPage(props: PageProps<"/tasks/[taskId]">) {
  return (
    <Suspense fallback={<p>불러오는 중…</p>}>
      <TaskDetail params={props.params} />
    </Suspense>
  );
}

async function TaskDetail({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  await requireMember(`/tasks/${taskId}`);
  if (!UUID.test(taskId)) notFound();

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, status")
    .eq("id", taskId)
    .maybeSingle();

  if (error) {
    return <Alert>업무를 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }
  if (!task) notFound();

  return (
    <div className="space-y-6">
      <PageHeader title={task.title} actions={<TaskStatusBadge status={task.status} />} />
      <EmptyState
        title="아직 준비 중입니다"
        description="업무 내용, 상태 변경, 공개 범위, 변경 이력이 여기에 표시됩니다."
      />
    </div>
  );
}
