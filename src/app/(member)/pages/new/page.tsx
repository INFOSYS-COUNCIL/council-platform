import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/detail";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { NewPageForm } from "./new-page-form";

export const metadata: Metadata = {
  title: "페이지 만들기",
};

// 국원을 포함한 학생회 구성원 누구나 만든다(2차 QA)
export default function NewPagePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="페이지 만들기" />
      <Suspense fallback={<Skeleton />}>
        <NewPageContent />
      </Suspense>
    </div>
  );
}

async function NewPageContent() {
  const membership = await requireMember("/pages/new");
  const org = await getTermOrgOptions(membership.termId);
  return <NewPageForm departments={departmentSelectOptions(org.departments)} members={memberSelectOptions(org.members)} />;
}
