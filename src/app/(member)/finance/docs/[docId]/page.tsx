import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DownloadButton, UploadVersionForm } from "@/components/finance/finance-dialogs";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Info, InfoList, Section, Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDateTime, todayInSeoul } from "@/lib/dates";
import { getFinanceContext } from "@/lib/finance/context";
import { downloadName, FINANCE_STATUS_LABELS, financeStatus } from "@/lib/finance/labels";
import { createClient } from "@/lib/supabase/server";
import { changeTaskStatus } from "../../../tasks/actions";

export const metadata: Metadata = {
  title: "재무 문서",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function FinanceDocPage(props: PageProps<"/finance/docs/[docId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <FinanceDoc params={props.params} />
    </Suspense>
  );
}

async function FinanceDoc({ params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const membership = await requireMember(`/finance/docs/${docId}`);
  if (!UUID.test(docId)) notFound();
  const me = (await getCurrentUserId())!;
  const supabase = await createClient();
  const [{ data: doc, error }, finance] = await Promise.all([
    supabase
      .from("finance_docs")
      .select(
        "id, title, semester, base_date, sensitive, created_by, task:tasks(id, status, assignee_id, manager_id), form:finance_forms(name), formVersion:finance_form_versions(version, file_path, file_name), versions:finance_doc_versions(id, version, file_path, file_name, note, created_at, uploaded_by, uploader:profiles(display_name, email))",
      )
      .eq("id", docId)
      .maybeSingle(),
    getFinanceContext(membership),
  ]);
  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  // 볼 수 없는 문서(다른 국·민감 문서)는 RLS가 돌려주지 않는다
  if (!doc) notFound();

  const task = [doc.task].flat()[0] ?? null;
  const formVersion = [doc.formVersion].flat()[0] ?? null;
  const status = financeStatus(task?.status);
  const versions = [...doc.versions].sort((a, b) => b.version - a.version);
  const latest = versions[0];
  const today = todayInSeoul();
  const nameOf = (p: unknown) => {
    const x = [p].flat()[0] as { display_name: string | null; email: string } | undefined;
    return x ? x.display_name?.trim() || x.email : "알 수 없음";
  };
  const ownerName = task?.assignee_id ? (finance.members.find((m) => m.userId === task.assignee_id)?.name ?? "(지난 구성원)") : null;

  // 표시용 판정. 실제 검사는 DB(add_finance_doc_version·change_task_status)가 한다
  const isAssignee = !!task && task.assignee_id === me;
  const isManager = finance.role === "EXECUTIVE" || finance.role === "DIRECTOR" || task?.manager_id === me;
  const canUpload = (isAssignee || finance.role === "EXECUTIVE" || finance.role === "DIRECTOR") && (status === "DRAFT" || (status === "IMPORTED" && finance.role !== "MEMBER"));
  const hidden = task && <input type="hidden" name="task_id" value={task.id} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={doc.title}
        description={`${[doc.form].flat()[0]?.name ?? "이관본"}${formVersion ? ` v${formVersion.version}` : ""} · ${doc.semester} · 기준일 ${doc.base_date}`}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-bold dark:bg-zinc-800">{FINANCE_STATUS_LABELS[status]}</span>
            {isAssignee && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">나에게 배정된</span>}
            {doc.sensitive && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold dark:bg-zinc-800">민감</span>}
          </span>
        }
      />
      <p>
        <SecondaryLinkButton href="/finance">← 재무국 업무</SecondaryLinkButton>
      </p>

      {/* 검토·승인: 연결된 업무의 기존 흐름(검토 요청 → 승인/다시 하기) */}
      {task && status === "DRAFT" && isAssignee && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
          <p className="text-sm">{versions.length === 0 ? "작성한 파일을 먼저 올린 뒤 검토를 요청하세요." : "다 작성했다면 재무국장에게 검토를 요청하세요."}</p>
          {versions.length > 0 && (
            <ActionForm action={changeTaskStatus} submitLabel="검토 요청 보내기">
              {hidden}
              <input type="hidden" name="status" value="REVIEW" />
            </ActionForm>
          )}
        </div>
      )}
      {task && status === "REVIEW" && isManager && (
        <div className="space-y-3 rounded-lg border border-coral-300 bg-coral-50 p-4 dark:border-coral-800 dark:bg-coral-900/20">
          <p className="font-semibold">검토 요청이 왔습니다</p>
          <p className="text-sm">최신 파일을 내려받아 확인한 뒤 승인하거나, 고칠 점이 있으면 다시 하도록 돌려보내 주세요.</p>
          <div className="flex flex-wrap gap-2">
            <ActionForm action={changeTaskStatus} submitLabel="승인 (완료)">
              {hidden}
              <input type="hidden" name="status" value="DONE" />
            </ActionForm>
            <ActionForm action={changeTaskStatus} submitLabel="다시 하기" variant="secondary">
              {hidden}
              <input type="hidden" name="status" value="IN_PROGRESS" />
            </ActionForm>
          </div>
        </div>
      )}
      {task && status === "REVIEW" && !isManager && <Alert tone="info">재무국장의 검토를 기다리는 중입니다. 검토 중에는 파일을 올릴 수 없습니다.</Alert>}

      <InfoList>
        <Info label="담당자">{task ? (ownerName ?? <span className="font-bold text-danger">미배정</span>) : "— (이관본)"}</Info>
        <Info label="연결 업무">{task ? <Link href={`/tasks/${task.id}`} className="underline">업무 보기</Link> : "없음"}</Info>
        <Info label="최신 파일">{latest ? `v${latest.version} · ${latest.file_name}` : formVersion ? `원본 양식 v${formVersion.version}` : "없음"}</Info>
        <Info label="열람 범위">{doc.sensitive ? "회장단·재무국장·만든 사람·담당자" : "회장단·재무국 구성원"}</Info>
      </InfoList>

      <div className="flex flex-wrap gap-2">
        {latest ? (
          <DownloadButton path={latest.file_path} fileName={downloadName(doc.title, doc.base_date, nameOf(latest.uploader))} label={`최신 파일 내려받기 (v${latest.version})`} />
        ) : (
          formVersion && <DownloadButton path={formVersion.file_path} fileName={downloadName(doc.title, doc.base_date, ownerName ?? "미배정")} label="원본 양식 내려받아 작성 시작" />
        )}
      </div>

      {canUpload && <UploadVersionForm termId={membership.termId} docId={doc.id} />}

      <Section title={`버전 ${versions.length}`}>
        {versions.length === 0 ? (
          <p className="text-sm text-muted">아직 올린 파일이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {versions.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <span className="min-w-0">
                  <span className="block font-semibold">
                    v{v.version} · {v.file_name}
                  </span>
                  <span className="block text-sm text-muted">
                    {nameOf(v.uploader)} · {formatDateTime(v.created_at, today)}
                    {v.note && ` · ${v.note}`}
                  </span>
                </span>
                <DownloadButton path={v.file_path} fileName={downloadName(doc.title, doc.base_date, nameOf(v.uploader))} />
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
