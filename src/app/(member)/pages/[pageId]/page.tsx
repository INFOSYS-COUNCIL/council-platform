import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { ManageMenu, type ManageItem } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDateTime, todayInSeoul } from "@/lib/dates";
import { markdownFileName } from "@/lib/meetings/export";
import { fetchMeetingState } from "@/lib/meetings/queries";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { PAGE_SCOPE_LABELS, type PageScope } from "@/lib/pages/labels";
import { createClient } from "@/lib/supabase/server";
import { MeetingEditor } from "../../meetings/[meetingId]/meeting-editor";
import { deletePage, updatePage } from "../actions";
import { PageFields } from "../page-fields";

export const metadata: Metadata = {
  title: "페이지",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 페이지 상세: 볼 수 있는 사람은 모두 본문을 함께 고친다(회의록과 같은 공동 편집기).
// 제목·태그·공개 범위 수정과 삭제는 만든 사람 또는 회장단(DB 함수가 다시 검사한다).
export default function PageDetailPage(props: PageProps<"/pages/[pageId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <PageDetail params={props.params} />
    </Suspense>
  );
}

async function PageDetail({ params }: { params: Promise<{ pageId: string }> }) {
  const { pageId } = await params;
  const membership = await requireMember(`/pages/${pageId}`);
  if (!UUID.test(pageId)) notFound();
  const me = (await getCurrentUserId())!;

  const supabase = await createClient();
  const [pageResult, rulesResult, org] = await Promise.all([
    supabase.from("meeting_minutes").select("id, kind, title, tags, meeting_at, created_by, status").eq("id", pageId).maybeSingle(),
    supabase.from("meeting_access_rules").select("subject_type, role_group, department_id, user_id").eq("meeting_id", pageId),
    getTermOrgOptions(membership.termId),
  ]);
  if (pageResult.error || rulesResult.error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const page = pageResult.data;
  if (!page) notFound();
  if (page.kind !== "PAGE") redirect(`/meetings/${page.id}`);

  let state;
  try {
    state = await fetchMeetingState(supabase, pageId);
  } catch {
    return <Alert>본문을 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }

  const rules = rulesResult.data;
  const scope: PageScope = rules.some((r) => r.subject_type === "USER")
    ? "USERS"
    : rules.some((r) => r.subject_type === "DEPARTMENT")
      ? "DEPARTMENTS"
      : "ALL_COUNCIL";
  const departmentIds = rules.flatMap((r) => (r.department_id ? [r.department_id] : []));
  const userIds = rules.flatMap((r) => (r.user_id ? [r.user_id] : []));
  const nameOf = (id: string) => org.members.find((m) => m.userId === id)?.name ?? "(비활성 구성원)";
  const scopeDetail =
    scope === "DEPARTMENTS"
      ? departmentIds.map((id) => org.departments.find((d) => d.id === id)?.name ?? "비활성 부서").join(", ")
      : scope === "USERS"
        ? userIds.map(nameOf).join(", ")
        : null;
  const canManage = membership.role === "EXECUTIVE" || page.created_by === me;
  const today = todayInSeoul();
  const hidden = <input type="hidden" name="page_id" value={page.id} />;

  const manageItems: ManageItem[] = canManage
    ? [
        {
          key: "edit",
          label: "수정",
          wide: true,
          content: (
            <ActionForm action={updatePage} submitLabel="저장">
              {hidden}
              <PageFields
                departments={departmentSelectOptions(org.departments)}
                members={memberSelectOptions(org.members)}
                initial={{ title: page.title, tags: page.tags, scope, departmentIds, userIds }}
              />
            </ActionForm>
          ),
        },
        {
          key: "delete",
          label: "삭제",
          danger: true,
          content: (
            <ActionForm action={deletePage} submitLabel="삭제">
              {hidden}
              <p className="text-sm">이 페이지를 지웁니다. 되돌릴 수 없습니다.</p>
            </ActionForm>
          ),
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={page.title}
        description={`${formatDateTime(page.meeting_at, today)} · 만든 사람 ${nameOf(page.created_by)} · ${PAGE_SCOPE_LABELS[scope].label}${scopeDetail ? ` (${scopeDetail})` : ""}`}
        actions={<ManageMenu title="페이지 관리" subtitle={page.title} items={manageItems} />}
      />
      {page.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {page.tags.map((t) => (
            <Badge key={t} tone="muted">{`#${t}`}</Badge>
          ))}
        </div>
      )}
      <Section title="본문">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          &quot;/페이지&quot;로 새 페이지를 만들어 링크를 넣을 수 있습니다. 링크를 누르면 그 페이지로 이동합니다.
        </p>
        <MeetingEditor
          meetingId={page.id}
          initialState={state.state}
          initialSeq={state.lastSeq}
          canEdit={page.status === "DRAFT"}
          user={{ id: me, name: nameOf(me) }}
          fileName={markdownFileName(page.meeting_at, page.title)}
        />
      </Section>
    </div>
  );
}
