import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/detail";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { isoToSeoulLocal } from "@/lib/dates";
import { MEETING_CREATE_ROLES } from "@/lib/meetings/labels";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { NewMeetingForm } from "./new-meeting-form";

export const metadata: Metadata = {
  title: "회의록 만들기",
};

export default function NewMeetingPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="회의록 만들기" />
      <Suspense fallback={<Skeleton />}>
        <NewMeetingContent />
      </Suspense>
    </div>
  );
}

async function NewMeetingContent() {
  const membership = await requireMember("/meetings/new", MEETING_CREATE_ROLES);
  const me = (await getCurrentUserId())!;
  const supabase = await createClient();
  const [org, templates] = await Promise.all([
    getTermOrgOptions(membership.termId),
    supabase.from("meeting_templates").select("id, name").eq("term_id", membership.termId).eq("is_active", true).order("name"),
  ]);
  if (templates.error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;

  return (
    <NewMeetingForm
      me={me}
      defaultMeetingAt={isoToSeoulLocal(new Date().toISOString()).slice(0, 14) + "00"}
      members={memberSelectOptions(org.members)}
      departments={departmentSelectOptions(org.departments)}
      templates={templates.data.map((t) => ({ value: t.id, label: t.name }))}
    />
  );
}
