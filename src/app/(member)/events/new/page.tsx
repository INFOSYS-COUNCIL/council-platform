import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/detail";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { EVENT_CREATE_ROLES } from "@/lib/events/labels";
import { departmentSelectOptions, getTermOrgOptions } from "@/lib/org/options";
import { NewEventForm } from "./new-event-form";

export const metadata: Metadata = {
  title: "행사 만들기 | 학생회 운영 플랫폼",
};

export default function NewEventPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="행사 만들기" />
      <Suspense fallback={<Skeleton />}>
        <NewEventContent />
      </Suspense>
    </div>
  );
}

async function NewEventContent() {
  const membership = await requireMember("/events/new", EVENT_CREATE_ROLES);
  const { departments } = await getTermOrgOptions(membership.termId);
  return (
    <NewEventForm
      departments={departmentSelectOptions(departments)}
      defaultDepartmentId={membership.departmentId ?? ""}
    />
  );
}
