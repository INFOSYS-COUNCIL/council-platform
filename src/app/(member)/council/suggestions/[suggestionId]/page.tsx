import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Info, InfoList, Section, Skeleton } from "@/components/ui/detail";
import { ManageMenu } from "@/components/ui/manage-menu";
import { SelectField, TextareaField } from "@/components/ui/form-field";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTION_STATUS_LABELS, SUGGESTION_STATUS_ORDER } from "@/lib/suggestions/labels";
import {
  addSuggestionMessage,
  assignSuggestion,
  changeSuggestionStatus,
  deleteSuggestionMessage,
  updateSuggestionMessage,
} from "../../../suggestions/actions";

export const metadata: Metadata = {
  title: "건의 처리 상세",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CouncilSuggestionPage(props: PageProps<"/council/suggestions/[suggestionId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <CouncilSuggestion params={props.params} />
    </Suspense>
  );
}

async function CouncilSuggestion({ params }: { params: Promise<{ suggestionId: string }> }) {
  const { suggestionId } = await params;
  const membership = await requireMember(`/council/suggestions/${suggestionId}`);
  if (!UUID.test(suggestionId)) notFound();
  const isExecutive = membership.role === "EXECUTIVE";

  const supabase = await createClient();
  const [{ data: s, error }, { data: messages, error: messagesError }, identity, org] = await Promise.all([
    supabase
      .from("suggestions")
      .select("id, title, content, status, created_at, withdrawn_at, assigned_department_id, assigned_user_id, department:departments(name)")
      .eq("id", suggestionId)
      .maybeSingle(),
    supabase
      .from("suggestion_messages")
      .select("id, message_type, body, created_at, updated_at, writer_id, writer:profiles!suggestion_messages_writer_id_fkey(display_name, email)")
      .eq("suggestion_id", suggestionId)
      .order("created_at"),
    // 신원은 회장단만 (7.1절). 다른 사람은 부르지도 않는다
    isExecutive ? supabase.rpc("suggestion_author_identity", { p_suggestion_id: suggestionId }) : null,
    getTermOrgOptions(membership.termId),
  ]);

  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  // 배정되지 않은 건의는 RLS가 돌려주지 않는다
  if (!s) notFound();

  const author = identity?.data?.[0];
  const closed = s.withdrawn_at !== null;
  // 답변·메모 수정·삭제: 회장단 또는 맡은 국의 국장(이 화면은 처리자만 볼 수 있다). DB 함수가 다시 검사한다.
  const canEditMessages = isExecutive || membership.role === "DIRECTOR";
  const hidden = <input type="hidden" name="suggestion_id" value={s.id} />;
  const assignee = org.members.find((m) => m.userId === s.assigned_user_id);

  return (
    <div className="space-y-8">
      <PageHeader title={s.title} actions={<Badge tone="neutral">{SUGGESTION_STATUS_LABELS[s.status]}</Badge>} />
      <p>
        <SecondaryLinkButton href="/council/suggestions">
          ← 건의 처리 목록
        </SecondaryLinkButton>
      </p>
      {closed && <Alert tone="info">작성자가 철회한 건의입니다.</Alert>}

      <InfoList>
        <Info label="제출">{new Date(s.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" })}</Info>
        <Info label="배정">{s.department?.name ?? "미배정"}{assignee ? ` · ${assignee.name}` : ""}</Info>
        {isExecutive && (
          <Info label="작성자 (회장단에게만 보임)">{author ? `${author.display_name ?? ""} ${author.email}`.trim() : "확인할 수 없음"}</Info>
        )}
      </InfoList>

      <Section title="내용">
        <p className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">{s.content}</p>
      </Section>

      <Section title="답변과 메모">
        {messagesError ? (
          <Alert>답변을 불러오지 못했습니다. 새로고침해 주세요.</Alert>
        ) : !messages || messages.length === 0 ? (
          <p className="text-sm">아직 남긴 글이 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`rounded-md border-l-4 p-3 ${m.message_type === "AUTHOR_VISIBLE" ? "border-coral-500 bg-coral-50 dark:bg-zinc-900" : "border-zinc-400 bg-zinc-100 dark:bg-zinc-800"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <Badge tone={m.message_type === "AUTHOR_VISIBLE" ? "strong" : "muted"}>
                    {m.message_type === "AUTHOR_VISIBLE" ? "작성자에게 공개" : "내부 메모"}
                  </Badge>
                  {!closed && canEditMessages && (
                    <ManageMenu
                      title={m.message_type === "AUTHOR_VISIBLE" ? "답변 관리" : "메모 관리"}
                      subtitle={m.body.slice(0, 30)}
                      items={[
                        {
                          key: "edit",
                          label: "수정",
                          content: (
                            <ActionForm action={updateSuggestionMessage} submitLabel="고친 내용 저장">
                              {hidden}
                              <input type="hidden" name="message_id" value={m.id} />
                              <TextareaField
                                label="내용"
                                name="body"
                                rows={5}
                                maxLength={3000}
                                required
                                defaultValue={m.body}
                                hint={m.message_type === "AUTHOR_VISIBLE" ? "고친 내용이 작성자에게 바로 보입니다." : undefined}
                              />
                            </ActionForm>
                          ),
                        },
                        {
                          key: "delete",
                          label: "삭제",
                          danger: true,
                          content: (
                            <ActionForm action={deleteSuggestionMessage} submitLabel="삭제">
                              {hidden}
                              <input type="hidden" name="message_id" value={m.id} />
                              <p className="text-sm">
                                이 글을 지웁니다. 되돌릴 수 없습니다.
                                {m.message_type === "AUTHOR_VISIBLE" && " 작성자 화면에서도 사라집니다."}
                              </p>
                            </ActionForm>
                          ),
                        },
                      ]}
                    />
                  )}
                </div>
                <p className="mt-2 whitespace-pre-wrap">{m.body}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {m.writer?.display_name?.trim() || m.writer?.email} ·{" "}
                  {new Date(m.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}
                  {m.updated_at && " · 수정됨"}
                </p>
              </li>
            ))}
          </ol>
        )}

        {!closed && (
          <div className="grid gap-6 sm:grid-cols-2">
            <ActionForm action={addSuggestionMessage} submitLabel="내부 메모 남기기">
              {hidden}
              <input type="hidden" name="message_type" value="INTERNAL" />
              <TextareaField label="내부 메모" name="body" rows={4} maxLength={3000} required hint="처리자와 회장단만 봅니다." />
            </ActionForm>
            <ActionForm
              action={addSuggestionMessage}
              submitLabel="작성자에게 답변"
              variant="secondary"
              confirmMessage="이 답변은 작성자에게 바로 공개됩니다. 남길까요?"
            >
              {hidden}
              <input type="hidden" name="message_type" value="AUTHOR_VISIBLE" />
              <TextareaField label="작성자 공개 답변" name="body" rows={4} maxLength={3000} required hint="작성자가 내 건의 화면에서 봅니다." />
            </ActionForm>
          </div>
        )}
      </Section>

      {!closed && (
        <Section title="처리">
          <div className="grid gap-6 sm:grid-cols-2">
            <ActionForm action={changeSuggestionStatus} submitLabel="상태 바꾸기" variant="secondary">
              {hidden}
              <SelectField
                label="상태"
                name="status"
                defaultValue={s.status}
                options={SUGGESTION_STATUS_ORDER.map((st) => ({ value: st, label: SUGGESTION_STATUS_LABELS[st] }))}
                hint="처리 완료·종료 전에 작성자 공개 답변이 하나 이상 있어야 합니다."
              />
            </ActionForm>
            {isExecutive && (
              <ActionForm action={assignSuggestion} submitLabel="배정 저장" variant="secondary">
                {hidden}
                <SelectField label="담당 부서" name="department_id" placeholder="미배정" options={departmentSelectOptions(org.departments)} defaultValue={s.assigned_department_id ?? ""} />
                <SelectField label="담당자" name="user_id" placeholder="부서 국장이 처리" options={memberSelectOptions(org.members)} defaultValue={s.assigned_user_id ?? ""} />
              </ActionForm>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
