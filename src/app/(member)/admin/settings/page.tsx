import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { getCouncilProfile } from "@/lib/site";
import { saveCouncilName, saveTaskDueSoon } from "./actions";

export const metadata: Metadata = { title: "학생회 설정" };

const ROUTE = ADMIN_ROUTES.settings;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="학생회 설정" description="학생회 이름과 업무의 마감 임박 기준을 설정합니다." />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <SettingsForm />
      </Suspense>
    </div>
  );
}

async function SettingsForm() {
  await requireMember(ROUTE.href, ROUTE.roles);
  const { name, generation, dueSoonDays } = await getCouncilProfile();
  return (
    <div className="max-w-md space-y-8">
      <ActionForm action={saveCouncilName} submitLabel="이름·기수 저장" className="space-y-3">
        <TextField label="학생회 이름" name="council_name" required maxLength={30} defaultValue={name} hint="예: 가온" />
        <TextField
          label="기수"
          name="council_generation"
          type="number"
          min={1}
          max={999}
          defaultValue={generation ?? ""}
          hint="숫자만 입력합니다. 예: 17 → 제 17대 정보시스템학과 학생회. 비우면 기수를 표시하지 않습니다."
        />
      </ActionForm>
      <ActionForm action={saveTaskDueSoon} submitLabel="마감 임박 기준 저장">
        <TextField label="마감 임박 기준 (일 전)" name="task_due_soon_days" type="number" min={0} max={365} step={1} required defaultValue={dueSoonDays} hint="0~365일. 마감일까지 남은 날짜가 이 값 이하인 업무와 마감이 지난 업무를 목록 위에 모읍니다. 0일이면 마감 당일부터 표시합니다." />
      </ActionForm>
    </div>
  );
}
