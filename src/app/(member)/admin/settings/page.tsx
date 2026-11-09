import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { getCouncilName } from "@/lib/site";
import { saveCouncilName } from "./actions";

export const metadata: Metadata = { title: "학생회 이름" };

const ROUTE = ADMIN_ROUTES.settings;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="학생회 이름" description="첫 화면, 사이드바, 탭 제목에 “<이름> 운영 플랫폼”으로 보입니다." />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <SettingsForm />
      </Suspense>
    </div>
  );
}

async function SettingsForm() {
  await requireMember(ROUTE.href, ROUTE.roles);
  const name = await getCouncilName();
  return (
    <ActionForm action={saveCouncilName} submitLabel="저장" className="max-w-md space-y-3">
      <TextField label="학생회 이름" name="council_name" required maxLength={30} defaultValue={name} hint="예: 가온 → 가온 운영 플랫폼" />
    </ActionForm>
  );
}
