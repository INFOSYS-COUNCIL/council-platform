import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge, MeetingStatusBadge } from "@/components/ui/badge";
import { DialogButton } from "@/components/ui/dialog-button";
import { Info, InfoList, Section, Skeleton } from "@/components/ui/detail";
import { SelectField, TextField } from "@/components/ui/form-field";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { ManageMenu, type ManageItem } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDateTime, isoToSeoulLocal, todayInSeoul } from "@/lib/dates";
import { MEETING_SCOPE_LABELS, MEETING_STATUS_HELP, MEETING_STATUS_LABELS } from "@/lib/meetings/labels";
import { fetchMeetingState } from "@/lib/meetings/queries";
import { getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import {
  addMeetingEditor,
  changeMeetingStatus,
  deleteMeeting,
  removeMeetingEditor,
  setMeetingAuthor,
  updateMeeting,
} from "../actions";
import { MeetingEditor } from "./meeting-editor";

export const metadata: Metadata = {
  title: "회의록",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MeetingDetailPage(props: PageProps<"/meetings/[meetingId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <MeetingDetail params={props.params} />
    </Suspense>
  );
}

async function MeetingDetail({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  const membership = await requireMember(`/meetings/${meetingId}`);
  if (!UUID.test(meetingId)) notFound();
  const me = (await getCurrentUserId())!;

  const supabase = await createClient();
  const [meetingResult, editorsResult, rulesResult, org] = await Promise.all([
    supabase.from("meeting_minutes").select("*, event:events(id, name)").eq("id", meetingId).maybeSingle(),
    supabase.from("meeting_editors").select("user_id").eq("meeting_id", meetingId),
    supabase.from("meeting_access_rules").select("subject_type, role_group, department_id").eq("meeting_id", meetingId),
    getTermOrgOptions(membership.termId),
  ]);
  if (meetingResult.error || editorsResult.error || rulesResult.error) {
    return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }
  const meeting = meetingResult.data;
  if (!meeting) notFound();

  let state;
  try {
    state = await fetchMeetingState(supabase, meetingId);
  } catch {
    return <Alert>본문을 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }

  const nameOf = (id: string) => org.members.find((m) => m.userId === id)?.name ?? "(비활성 구성원)";
  const editorIds = editorsResult.data.map((e) => e.user_id);
  // 표시용 판정. 실제 검사는 DB 함수(can_edit_meeting·can_manage_meeting·delete_meeting)가 한다.
  // 관리·삭제는 국장과 회장단만(3차 피드백): 회장단, 또는 만든 사람·대표 작성자인 국장.
  const isExecutive = membership.role === "EXECUTIVE";
  const isDirector = membership.role === "DIRECTOR";
  const canManage = isExecutive || (isDirector && meeting.created_by === me);
  const canEdit = meeting.status === "DRAFT" && (isExecutive || editorIds.includes(me));
  const archived = meeting.status === "ARCHIVED";
  const canHandleArchived = isExecutive || (isDirector && meeting.author_id === me);
  const canDelete = isExecutive || (isDirector && (meeting.created_by === me || meeting.author_id === me));
  const today = todayInSeoul();

  const groupRule = rulesResult.data.find((r) => r.subject_type === "ROLE_GROUP");
  const scopeLabel = groupRule
    ? MEETING_SCOPE_LABELS[groupRule.role_group as "ALL_COUNCIL" | "DIRECTORS" | "EXECUTIVES"].label
    : `선택한 국만 · ${rulesResult.data
        .map((r) => org.departments.find((d) => d.id === r.department_id)?.name ?? "비활성 부서")
        .join(", ")}`;
  const hidden = <input type="hidden" name="meeting_id" value={meeting.id} />;
  const candidates = memberSelectOptions(org.members.filter((m) => !editorIds.includes(m.userId)));

  // 관리 ⋯ 메뉴: 진행 상태·회의 정보·대표 작성자·삭제를 한곳에 모은다(화면에는 내용만 둔다)
  const manageItems: ManageItem[] = [];
  if (canManage && !archived) {
    manageItems.push(
      {
        key: "edit",
        label: "수정",
        content: (
          <ActionForm action={updateMeeting} submitLabel="저장">
            {hidden}
            <TextField label="제목" name="title" required maxLength={100} defaultValue={meeting.title} />
            <DateTimePicker label="회의 일시" name="meeting_at" required defaultValue={isoToSeoulLocal(meeting.meeting_at)} hint="한국 시간" />
          </ActionForm>
        ),
      },
      {
        key: "author",
        label: "대표 작성자 바꾸기",
        content: (
          <ActionForm action={setMeetingAuthor} submitLabel="대표 작성자 바꾸기">
            {hidden}
            <SelectField label="대표 작성자" name="user_id" options={memberSelectOptions(org.members)} defaultValue={meeting.author_id} />
          </ActionForm>
        ),
      },
      {
        key: "archive",
        label: "보관하기",
        content: (
          <ActionForm action={changeMeetingStatus} submitLabel="보관하기">
            {hidden}
            <input type="hidden" name="status" value="ARCHIVED" />
            <p className="text-sm">보관하면 보관하면 목록의 &quot;보관됨&quot;으로 옮겨지고 읽기만 할 수 있습니다.quot;보관함보관하면 목록의 &quot;보관됨&quot;으로 옮겨지고 읽기만 할 수 있습니다.quot;으로 옮겨지고 본문이 잠겨 읽기만 할 수 있습니다.</p>
          </ActionForm>
        ),
      },
    );
  }
  if (archived && canHandleArchived) {
    manageItems.push({
      key: "reopen",
      label: "보관 풀고 다시 편집하기",
      content: (
        <ActionForm action={changeMeetingStatus} submitLabel="다시 편집하기">
          {hidden}
          <input type="hidden" name="status" value="DRAFT" />
          <p className="text-sm">&quot;편집 중&quot;으로 돌아가 다시 고칠 수 있게 됩니다.</p>
        </ActionForm>
      ),
    });
  }
  if (canDelete) {
    manageItems.push({
      key: "delete",
      label: "삭제",
      danger: true,
      content: (
        <ActionForm action={deleteMeeting} submitLabel="삭제">
          {hidden}
          <input type="hidden" name="status_tab" value={meeting.status} />
          <p className="text-sm">이 회의록을 본문까지 완전히 지웁니다. 되돌릴 수 없습니다.</p>
        </ActionForm>
      ),
    });
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={meeting.title}
        actions={
          <span className="flex items-center gap-1">
            <MeetingStatusBadge status={meeting.status} />
            <ManageMenu title="회의록 관리" subtitle={meeting.title} items={manageItems} />
          </span>
        }
      />
      <p>
        <SecondaryLinkButton href="/meetings">
          ← 회의록 목록
        </SecondaryLinkButton>
      </p>
      <Alert tone="info">
        지금 <strong>{MEETING_STATUS_LABELS[meeting.status]}</strong> · {MEETING_STATUS_HELP[meeting.status]}
      </Alert>

      <Section title="개요">
        <InfoList>
          <Info label="회의 일시">{formatDateTime(meeting.meeting_at, today)}</Info>
          <Info label="대표 작성자">{nameOf(meeting.author_id)}</Info>
          <Info label="열람 범위">{scopeLabel}</Info>
          {meeting.confirmed_at && <Info label="최종 확정한 때">{formatDateTime(meeting.confirmed_at, today)}</Info>}
        </InfoList>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          회장단, 만든 사람, 대표 작성자와 편집자는 열람 범위와 상관없이 볼 수 있습니다.
          {meeting.event && " 행사를 볼 수 없는 사람은 볼 수 없습니다."}
        </p>
      </Section>

      <Section title="본문">
        <MeetingEditor
          meetingId={meeting.id}
          initialState={state.state}
          initialSeq={state.lastSeq}
          canEdit={canEdit}
          user={{ id: me, name: nameOf(me) }}
        />
      </Section>

      <Section
        title="편집자"
        action={
          canManage &&
          !archived &&
          candidates.length > 0 && (
            <DialogButton label="+ 편집자 추가">
              <ActionForm action={addMeetingEditor} submitLabel="편집자 추가">
                {hidden}
                <SelectField label="추가할 사람" name="user_id" options={candidates} placeholder="추가할 사람을 고르세요" />
              </ActionForm>
            </DialogButton>
          )
        }
      >
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {editorIds.map((id) => (
            <li key={id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 text-sm">
                {nameOf(id)} {id === meeting.author_id && <Badge tone="muted">대표 작성자</Badge>}
              </span>
              {canManage && !archived && id !== meeting.author_id && (
                <ActionForm action={removeMeetingEditor} submitLabel="빼기" variant="secondary">
                  {hidden}
                  <input type="hidden" name="user_id" value={id} />
                </ActionForm>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
