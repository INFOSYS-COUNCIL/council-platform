import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, InfoList, Section, Skeleton } from "@/components/ui/detail";
import { SelectField, TextareaField, TextField } from "@/components/ui/form-field";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDate, formatDateTime, isoToSeoulLocal, todayInSeoul } from "@/lib/dates";
import { scheduleDateRange } from "@/lib/schedules/week";
import {
  EVENT_STATUS_LABELS,
  EVENT_STATUS_ORDER,
  EVENT_VISIBILITY_LABELS,
  formatBytes,
} from "@/lib/events/labels";
import {
  aclRuleLabel,
  aclSubjectOptions,
  getTermOrgOptions,
  memberSelectOptions,
} from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { ACL_ROLE_GROUP_LABELS } from "@/lib/tasks/labels";
import {
  addEventAccessRule,
  addEventLink,
  changeEventStatus,
  deleteEventResource,
  removeEventAccessRule,
  setEventVisibility,
  updateEvent,
} from "../actions";
import { NewScheduleForm, ScheduleItem } from "../../schedule/schedule-parts";
import { UploadForm } from "./upload-form";

export const metadata: Metadata = {
  title: "행사 상세",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function EventDetailPage(props: PageProps<"/events/[eventId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <EventDetail params={props.params} />
    </Suspense>
  );
}

async function EventDetail({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const membership = await requireMember(`/events/${eventId}`);
  if (!UUID.test(eventId)) notFound();
  const me = (await getCurrentUserId())!;

  const supabase = await createClient();
  const [eventResult, rulesResult, resourcesResult, schedulesResult, org] = await Promise.all([
    supabase
      .from("events")
      .select("*, department:departments(name), manager:profiles!events_manager_id_fkey(display_name, email)")
      .eq("id", eventId)
      .maybeSingle(),
    supabase.from("event_access_rules").select("id, subject_type, department_id, user_id, role_group").eq("event_id", eventId),
    supabase
      .from("event_resources")
      .select("id, resource_type, title, description, external_url, size_bytes, uploaded_by, created_at, uploader:profiles!event_resources_uploaded_by_fkey(display_name, email)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false }),
    supabase
      .from("schedules")
      .select("id, title, location, event_id, created_by, is_all_day, start_date, end_date, starts_at, ends_at")
      .eq("event_id", eventId),
    getTermOrgOptions(membership.termId),
  ]);

  if (eventResult.error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const event = eventResult.data;
  if (!event) notFound();

  // 표시용 판정. 실제 검사는 DB 함수(can_manage_event)가 한다
  const canManage =
    membership.role === "EXECUTIVE" ||
    (membership.role === "DIRECTOR" &&
      (event.owner_department_id === membership.departmentId || event.manager_id === me));
  const archived = event.status === "ARCHIVED";
  const editable = canManage && !archived;
  const today = todayInSeoul();
  const statusIndex = EVENT_STATUS_ORDER.indexOf(event.status);
  // 한 단계 앞뒤만 고를 수 있다(D-15). 보관 해제는 회장단만
  const nextStatuses = EVENT_STATUS_ORDER.filter(
    (_, i) => Math.abs(i - statusIndex) === 1 && !(archived && membership.role !== "EXECUTIVE"),
  );
  const nameOf = (p: { display_name: string | null; email: string } | null) =>
    p ? p.display_name?.trim() || p.email : "없음";
  const hidden = <input type="hidden" name="event_id" value={event.id} />;

  return (
    <div className="space-y-8">
      <PageHeader
        title={event.name}
        actions={
          <span className="flex gap-1">
            <Badge tone={event.status === "ACTIVE" ? "strong" : "neutral"}>{EVENT_STATUS_LABELS[event.status]}</Badge>
            {event.visibility_mode === "RESTRICTED" && <Badge tone="muted">제한 공개</Badge>}
          </span>
        }
      />
      <p>
        <Link href="/events" className={`text-sm underline ${FOCUS_RING}`}>
          ← 행사 목록
        </Link>
      </p>
      {archived && <Alert tone="info">보관된 행사입니다. 읽기만 할 수 있습니다.</Alert>}

      <Section title="개요">
        <InfoList>
          <Info label="담당 국">{event.department?.name}</Info>
          <Info label="관리자">{nameOf(event.manager)}</Info>
          <Info label="시작">{formatDateTime(event.starts_at, today) || "미정"}</Info>
          <Info label="종료">{formatDateTime(event.ends_at, today) || "미정"}</Info>
          <Info label="공개 범위">{EVENT_VISIBILITY_LABELS[event.visibility_mode].label}</Info>
        </InfoList>
        <p className="whitespace-pre-wrap">{event.description || "설명이 없습니다."}</p>
      </Section>

      <Section title="일정">
        {schedulesResult.data && schedulesResult.data.length > 0 ? (
          <ul className="space-y-2">
            {[...schedulesResult.data]
              .sort((a, b) => scheduleDateRange(a)[0].localeCompare(scheduleDateRange(b)[0]) || (a.starts_at ?? "").localeCompare(b.starts_at ?? ""))
              .map((s) => (
                <ScheduleItem key={s.id} s={{ ...s, title: `${formatDate(scheduleDateRange(s)[0], today)} ${s.title}` }} canDelete={editable || s.created_by === me} />
              ))}
          </ul>
        ) : (
          <p className="text-sm">아직 일정이 없습니다.</p>
        )}
        {editable && <NewScheduleForm eventId={event.id} defaultDate={isoToSeoulLocal(event.starts_at).slice(0, 10) || today} />}
      </Section>

      {canManage && nextStatuses.length > 0 && (
        <Section title="상태">
          <ActionForm action={changeEventStatus} submitLabel="상태 바꾸기" className="flex flex-wrap items-end gap-3">
            {hidden}
            <SelectField
              label="바꿀 상태"
              name="status"
              options={nextStatuses.map((s) => ({ value: s, label: EVENT_STATUS_LABELS[s] }))}
              hint="한 단계씩 앞뒤로만 바꿀 수 있습니다."
            />
          </ActionForm>
        </Section>
      )}

      <Section title="자료">
        {resourcesResult.error ? (
          <Alert>자료를 불러오지 못했습니다.</Alert>
        ) : resourcesResult.data.length === 0 ? (
          <p className="text-sm">아직 자료가 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {resourcesResult.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <span className="min-w-0">
                  {r.resource_type === "UPLOAD" ? (
                    <a href={`/events/${event.id}/files/${r.id}`} className={`font-medium underline ${FOCUS_RING}`}>
                      {r.title}
                    </a>
                  ) : (
                    <a href={r.external_url!} target="_blank" rel="noopener noreferrer" className={`font-medium underline ${FOCUS_RING}`}>
                      {r.title} <span className="sr-only">(새 창)</span>↗
                    </a>
                  )}
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    {r.resource_type === "UPLOAD" ? `파일 ${formatBytes(r.size_bytes)}` : "외부 링크"} · {nameOf(r.uploader)}
                  </span>
                </span>
                {!archived && (canManage || r.uploaded_by === me) && (
                  <ActionForm
                    action={deleteEventResource}
                    submitLabel="지우기"
                    variant="secondary"
                    confirmMessage={`"${r.title}" 자료를 지울까요? 되돌릴 수 없습니다.`}
                  >
                    {hidden}
                    <input type="hidden" name="resource_id" value={r.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        {!archived && (
          <div className="grid gap-8 rounded-md border border-dashed border-zinc-300 p-4 sm:grid-cols-2 dark:border-zinc-700">
            <UploadForm termId={event.term_id} eventId={event.id} />
            <ActionForm action={addEventLink} submitLabel="링크 등록" variant="secondary">
              {hidden}
              <TextField label="제목" name="title" required maxLength={100} />
              <TextField label="주소" name="url" type="url" required pattern="https://.+" placeholder="https://" />
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="share_checked" required className="mt-1 accent-coral-700" />
                원본 서비스(Google Drive 등)의 공유 권한을 확인했습니다. 이 플랫폼의 공개 범위는 외부 링크를 보호하지 못합니다.
              </label>
            </ActionForm>
          </div>
        )}
      </Section>

      {editable && (
        <Section title="정보 수정">
          <ActionForm action={updateEvent} submitLabel="저장" variant="secondary">
            {hidden}
            <TextField label="행사 이름" name="name" required maxLength={100} defaultValue={event.name} />
            <TextareaField label="설명" name="description" rows={4} maxLength={10000} defaultValue={event.description} />
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="시작" name="starts_at" type="datetime-local" defaultValue={isoToSeoulLocal(event.starts_at)} />
              <TextField label="종료" name="ends_at" type="datetime-local" defaultValue={isoToSeoulLocal(event.ends_at)} />
              <SelectField label="관리자" name="manager_id" options={memberSelectOptions(org.members)} defaultValue={event.manager_id} />
            </div>
          </ActionForm>
        </Section>
      )}

      <Section title="공개 범위">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {EVENT_VISIBILITY_LABELS[event.visibility_mode].description}
        </p>
        {rulesResult.data && rulesResult.data.length > 0 && (
          <ul className="space-y-2">
            {rulesResult.data.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <span>{aclRuleLabel(rule, org, ACL_ROLE_GROUP_LABELS)}</span>
                {editable && (
                  <ActionForm action={removeEventAccessRule} submitLabel="빼기" variant="secondary">
                    {hidden}
                    <input type="hidden" name="rule_id" value={rule.id} />
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
        {editable && (
          <div className="grid gap-6 sm:grid-cols-2">
            <ActionForm action={addEventAccessRule} submitLabel="열람 대상 추가" variant="secondary">
              {hidden}
              <SelectField label="열람 대상" name="subject" placeholder="선택하세요" options={aclSubjectOptions(org, ACL_ROLE_GROUP_LABELS)} />
            </ActionForm>
            <ActionForm
              action={setEventVisibility}
              submitLabel="공개 범위 바꾸기"
              variant="secondary"
              confirmMessage="공개 범위를 바꾸면 이 행사와 자료를 볼 수 있는 사람이 달라집니다. 바꿀까요?"
            >
              {hidden}
              <SelectField
                label="공개 범위"
                name="visibility_mode"
                defaultValue={event.visibility_mode}
                options={(["ALL_COUNCIL", "RESTRICTED"] as const).map((m) => ({ value: m, label: EVENT_VISIBILITY_LABELS[m].label }))}
              />
            </ActionForm>
          </div>
        )}
      </Section>
    </div>
  );
}
