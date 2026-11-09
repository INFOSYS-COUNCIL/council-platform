import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, InfoList, Section, Skeleton } from "@/components/ui/detail";
import { SelectField, TextField } from "@/components/ui/form-field";
import { FOCUS_RING } from "@/components/ui/link-button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDateTime, isoToSeoulLocal, todayInSeoul } from "@/lib/dates";
import { MEETING_SCOPE_LABELS, MEETING_STATUS_LABELS } from "@/lib/meetings/labels";
import { fetchMeetingState } from "@/lib/meetings/queries";
import { getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import {
  addMeetingEditor,
  changeMeetingStatus,
  confirmMeeting,
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
  // 표시용 판정. 실제 검사는 DB 함수(can_edit_meeting·can_manage_meeting)가 한다
  const isExecutive = membership.role === "EXECUTIVE";
  const canManage = isExecutive || meeting.created_by === me;
  const canEdit = meeting.status === "DRAFT" && (isExecutive || editorIds.includes(me));
  const archived = meeting.status === "ARCHIVED";
  const today = todayInSeoul();

  const groupRule = rulesResult.data.find((r) => r.subject_type === "ROLE_GROUP");
  const scopeLabel = groupRule
    ? MEETING_SCOPE_LABELS[groupRule.role_group as "ALL_COUNCIL" | "DIRECTORS" | "EXECUTIVES"].label
    : `특정 국 · ${rulesResult.data
        .map((r) => org.departments.find((d) => d.id === r.department_id)?.name ?? "비활성 부서")
        .join(", ")}`;
  const hidden = <input type="hidden" name="meeting_id" value={meeting.id} />;
  const candidates = memberSelectOptions(org.members.filter((m) => !editorIds.includes(m.userId)));

  return (
    <div className="space-y-8">
      <PageHeader
        title={meeting.title}
        actions={<Badge tone={meeting.status === "CONFIRMED" ? "strong" : "neutral"}>{MEETING_STATUS_LABELS[meeting.status]}</Badge>}
      />
      <p>
        <Link href="/meetings" className={`text-sm underline ${FOCUS_RING}`}>
          ← 회의록 목록
        </Link>
      </p>
      {meeting.status === "CONFIRMED" && <Alert tone="info">확정된 회의록입니다. 읽기만 할 수 있습니다.</Alert>}
      {archived && <Alert tone="info">보관된 회의록입니다. 읽기만 할 수 있습니다.</Alert>}

      <Section title="개요">
        <InfoList>
          <Info label="회의 일시">{formatDateTime(meeting.meeting_at, today)}</Info>
          <Info label="행사">
            {meeting.event ? (
              <Link href={`/events/${meeting.event.id}`} className={`underline ${FOCUS_RING}`}>
                {meeting.event.name}
              </Link>
            ) : (
              "없음"
            )}
          </Info>
          <Info label="대표 작성자">{nameOf(meeting.author_id)}</Info>
          <Info label="열람 범위">{scopeLabel}</Info>
          <Info label="편집자">{editorIds.map(nameOf).join(", ")}</Info>
          {meeting.confirmed_at && <Info label="확정">{formatDateTime(meeting.confirmed_at, today)}</Info>}
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

      {canManage && (
        <Section title="상태">
          <div className="flex flex-wrap gap-3">
            {meeting.status === "DRAFT" && (
              <ActionForm
                action={confirmMeeting}
                submitLabel="확정하기"
                confirmMessage="확정하면 편집자도 본문을 고칠 수 없습니다. 확정할까요?"
              >
                {hidden}
              </ActionForm>
            )}
            {!archived && (
              <ActionForm action={changeMeetingStatus} submitLabel="보관하기" variant="secondary" confirmMessage="보관하면 목록에서 숨겨지고 읽기 전용이 됩니다. 보관할까요?">
                {hidden}
                <input type="hidden" name="status" value="ARCHIVED" />
              </ActionForm>
            )}
            {archived && isExecutive && (
              <ActionForm action={changeMeetingStatus} submitLabel="보관 해제(작성 중으로)" variant="secondary">
                {hidden}
                <input type="hidden" name="status" value="DRAFT" />
              </ActionForm>
            )}
          </div>
          {meeting.status === "CONFIRMED" && isExecutive && (
            <ActionForm action={changeMeetingStatus} submitLabel="확정 해제" variant="secondary" className="flex flex-wrap items-end gap-3">
              {hidden}
              <input type="hidden" name="status" value="DRAFT" />
              <TextField label="해제 사유" name="reason" required maxLength={200} hint="활동 기록에 남습니다." />
            </ActionForm>
          )}
        </Section>
      )}

      {canManage && !archived && (
        <>
          <Section title="회의 정보">
            <ActionForm action={updateMeeting} submitLabel="저장" className="grid gap-4 sm:grid-cols-2">
              {hidden}
              <TextField label="제목" name="title" required maxLength={100} defaultValue={meeting.title} />
              <DateTimePicker label="회의 일시" name="meeting_at" required defaultValue={isoToSeoulLocal(meeting.meeting_at)} hint="한국 시간" />
            </ActionForm>
          </Section>

          <Section title="작성자·편집자">
            <ActionForm action={setMeetingAuthor} submitLabel="대표 작성자 바꾸기" className="flex flex-wrap items-end gap-3">
              {hidden}
              <SelectField label="대표 작성자" name="user_id" options={memberSelectOptions(org.members)} defaultValue={meeting.author_id} />
            </ActionForm>
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
              {editorIds.map((id) => (
                <li key={id} className="flex items-center justify-between gap-3 p-3">
                  <span>
                    {nameOf(id)} {id === meeting.author_id && <Badge tone="muted">대표 작성자</Badge>}
                  </span>
                  {id !== meeting.author_id && (
                    <ActionForm action={removeMeetingEditor} submitLabel="빼기" variant="secondary">
                      {hidden}
                      <input type="hidden" name="user_id" value={id} />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
            {candidates.length > 0 && (
              <ActionForm action={addMeetingEditor} submitLabel="편집자 추가" className="flex flex-wrap items-end gap-3">
                {hidden}
                <SelectField label="추가할 편집자" name="user_id" options={candidates} placeholder="선택하세요" />
              </ActionForm>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
