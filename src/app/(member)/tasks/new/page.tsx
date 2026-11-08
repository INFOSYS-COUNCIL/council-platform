import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import {
  departmentSelectOptions,
  getTermOrgOptions,
  memberSelectOptions,
} from "@/lib/org/options";
import { TASK_CREATE_ROLES } from "@/lib/tasks/labels";
import { NewTaskForm } from "./new-task-form";

export const metadata: Metadata = {
  title: "업무 만들기 | 학생회 운영 플랫폼",
};

export default function NewTaskPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="업무 만들기" />
      <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />}>
        <NewTaskContent />
      </Suspense>
    </div>
  );
}

async function NewTaskContent() {
  const membership = await requireMember("/tasks/new", TASK_CREATE_ROLES);
  const { departments, members } = await getTermOrgOptions(membership.termId);

  return (
    <NewTaskForm
      departments={departmentSelectOptions(departments)}
      members={memberSelectOptions(members)}
      // 국장은 자기 국 업무를 만드는 경우가 대부분이라 미리 고른다 (D-3)
      defaultDepartmentId={membership.departmentId ?? ""}
    />
  );
}
