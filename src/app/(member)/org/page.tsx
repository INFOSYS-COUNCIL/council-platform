import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { OrgChart } from "@/components/org/org-chart";
import { requireMember } from "@/lib/auth/session";
import { getPublicOrgChart } from "@/lib/org/public-chart";

export const metadata: Metadata = {
  title: "조직도",
};

// 업무 공간 > 조직도: 역할과 상관없이 학생회 전체 조직도를 본다(2차 QA). 업무는 업무 현황에서 본다.
export default function OrgPage() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="조직도" description="이번 기수 학생회 구성원입니다." />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <OrgContent />
      </Suspense>
    </div>
  );
}

async function OrgContent() {
  await requireMember("/org");
  const chart = await getPublicOrgChart().catch(() => null);
  if (!chart) return <Alert>조직도를 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  return <OrgChart {...chart} />;
}
