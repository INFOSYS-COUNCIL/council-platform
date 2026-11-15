import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge, SuggestionStatusBadge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { ManageMenu } from "@/components/ui/manage-menu";
import { SelectField, TextareaField } from "@/components/ui/form-field";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { isSuggestionHandler, SUGGESTION_HANDLER_ROLES } from "@/lib/suggestions/handler";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTION_STATUS_LABELS, SUGGESTION_STATUS_ORDER } from "@/lib/suggestions/labels";
import {
  approveSuggestionMessage,
  assignSuggestion,
  changeSuggestionStatus,
  deleteSuggestionMessage,
  updateSuggestionMessage,
} from "../../../suggestions/actions";

import { ReplyForm } from "./reply-form";

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

async function CouncilSuggestion({ params }: { params: Promise<{ suggestionId: string; }>; }) {
  const { suggestionId } = await params;
  const membership = await requireMember(`/council/suggestions/${suggestionId}`, SUGGESTION_HANDLER_ROLES);
  if (!UUID.test(suggestionId)) notFound();
  const isExecutive = membership.role === "EXECUTIVE";

  const supabase = await createClient();
  const [{ data: s, error }, { data: messages, error: messagesError }, identity, org] = await Promise.all([
    supabase
      .from("suggestions")
      .select("id, title, content, status, visibility, created_at, withdrawn_at, assigned_department_id, assigned_user_id, department:departments(name)")
      .eq("id", suggestionId)
      .maybeSingle(),
    supabase
      .from("suggestion_messages")
      .select("id, message_type, body, created_at, updated_at, approved_at, writer_id, writer:profiles!suggestion_messages_writer_id_fkey(display_name, email)")
      .eq("suggestion_id", suggestionId)
      .order("created_at"),
    // 신원은 회장단만 (7.1절). 다른 사람은 부르지도 않는다
    isExecutive ? supabase.rpc("suggestion_author_identity", { p_suggestion_id: suggestionId }) : null,
    getTermOrgOptions(membership.termId),
  ]);

  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  // 배정되지 않은 건의는 RLS가 돌려주지 않는다. 전체 공개 건의는 돌려주므로 처리 담당인지 다시 본다
  if (!s || !isSuggestionHandler(membership, (await getCurrentUserId())!, s)) notFound();

  const author = identity?.data?.[0];
  const closed = s.withdrawn_at !== null;
  // 답변·메모 수정·삭제: 회장단 또는 맡은 국의 국장(이 화면은 처리자만 볼 수 있다). DB 함수가 다시 검사한다.
  const canEditMessages = isExecutive || membership.role === "DIRECTOR";
  const hidden = <input type="hidden" name="suggestion_id" value={s.id} />;
  const assignee = org.members.find((m) => m.userId === s.assigned_user_id);

  return (
    <div className="space-y-8">
      <SecondaryLinkButton href="/council/suggestions">← 받은 건의</SecondaryLinkButton>
      <PageHeader title={s.title} />
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-5 text-sm text-muted dark:border-zinc-800">
        <SuggestionStatusBadge status={s.status} />
        <span>{new Date(s.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "medium", timeStyle: "short" })} 제출</span>
        <span>{s.visibility === "PUBLIC" ? "전체 공개 건의" : "비공개 건의"}</span>
      </div>
      {closed && <Alert tone="info">작성자가 철회한 건의입니다.</Alert>}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Section title="건의 내용">
            <p className="whitespace-pre-wrap rounded-xl border border-zinc-200 bg-surface p-5 leading-relaxed dark:border-zinc-800">{s.content}</p>
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
                    className={`rounded-xl p-4 ${m.message_type === "AUTHOR_VISIBLE" ? "border border-zinc-200 bg-surface dark:border-zinc-800" : "bg-zinc-100 dark:bg-zinc-800"}`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={m.message_type === "AUTHOR_VISIBLE" ? "strong" : "muted"}>
                        {m.message_type === "AUTHOR_VISIBLE" ? "작성자 답변" : "내부 메모"}
                      </Badge>
                      {m.message_type === "AUTHOR_VISIBLE" && (
                        <Badge tone={m.approved_at ? "success" : "warning"}>{m.approved_at ? "승인됨 · 작성자에게 보임" : "승인 대기 · 아직 안 보임"}</Badge>
                      )}
                      <span className="flex-1" />
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
                                    hint={m.message_type === "AUTHOR_VISIBLE" ? "고치면 다시 승인 대기가 되고, 승인해야 작성자에게 보입니다." : undefined}
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
                    {!closed && m.message_type === "AUTHOR_VISIBLE" && !m.approved_at && (
                      <ActionForm
                        action={approveSuggestionMessage}
                        submitLabel="승인하고 작성자에게 공개"
                        confirmMessage={s.visibility === "PUBLIC" ? "승인하면 작성자와 모든 학생에게 보입니다. 승인할까요?" : "승인하면 작성자에게 보입니다. 승인할까요?"}
                        className="mt-2"
                      >
                        {hidden}
                        <input type="hidden" name="message_id" value={m.id} />
                      </ActionForm>
                    )}
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {m.writer?.display_name?.trim() || m.writer?.email} ·{" "}
                      {new Date(m.updated_at ?? m.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}
                      {m.updated_at && " · 수정됨"}
                    </p>
                  </li>
                ))}
              </ol>
            )}

            {!closed && <ReplyForm suggestionId={s.id} isPublic={s.visibility === "PUBLIC"} />}
          </Section>

        </div>
        <aside className="space-y-4">
          {!closed && (
            <div className="space-y-5 rounded-xl border border-zinc-200 bg-surface p-5 dark:border-zinc-800">
              <h2 className="font-semibold">처리</h2>
              <div className="space-y-5">
                <ActionForm action={changeSuggestionStatus} submitLabel="상태 바꾸기" variant="secondary">
                  {hidden}
                  <SelectField
                    label="상태"
                    name="status"
                    defaultValue={s.status}
                    options={SUGGESTION_STATUS_ORDER.map((st) => ({ value: st, label: SUGGESTION_STATUS_LABELS[st] }))}
                    hint="답변 완료로 바꾸려면 승인된 작성자 답변이 하나 이상 있어야 합니다."
                  />
                </ActionForm>
                {isExecutive && (
                  <ActionForm action={assignSuggestion} submitLabel="배정 저장" variant="secondary">
                    {hidden}
                    <SelectField label="담당 부서" name="department_id" placeholder="미배정" options={departmentSelectOptions(org.departments)} defaultValue={s.assigned_department_id ?? ""} />
                    <SelectField label="담당자" name="user_id" placeholder="부서 국장이 처리" hint="국장이나 회장단만 맡을 수 있습니다." options={memberSelectOptions(org.members.filter((m) => m.role !== "MEMBER"))} defaultValue={s.assigned_user_id ?? ""} />
                  </ActionForm>
                )}
              </div>
            </div>
          )}
          <div className="space-y-2 rounded-xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
            <h2 className="font-semibold">담당</h2>
            <p className="text-muted">{s.department?.name ?? "미배정"}{assignee ? ` · ${assignee.name}` : ""}</p>
          </div>
          {isExecutive && <div className="space-y-2 rounded-xl border border-zinc-200 p-5 text-sm dark:border-zinc-800">
            <h2 className="font-semibold">작성자 <span className="font-normal text-muted">· 회장단만 보임</span></h2>
            {author ? <><p>{author.display_name ?? "이름 없음"}</p><p className="break-all text-muted">{author.email}</p></> : <p className="text-muted">확인할 수 없음</p>}
          </div>}
        </aside>
      </div>
    </div>
  );
}
