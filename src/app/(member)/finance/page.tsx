import type { Metadata } from "next";
import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { FormPreviewButton, ImportDocButton, RegisterFormButton } from "@/components/finance/finance-dialogs";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Section, Skeleton } from "@/components/ui/detail";
import { SelectField } from "@/components/ui/form-field";
import { FOCUS_RING } from "@/components/ui/link-button";
import { ManageMenu } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { PillLink } from "@/components/ui/pagination";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { todayInSeoul } from "@/lib/dates";
import { getFinanceContext } from "@/lib/finance/context";
import { FINANCE_EVENTS, FINANCE_STATUS_LABELS, FINANCE_STATUS_ORDER, financeStatus, semesterOf, type FinanceStatus } from "@/lib/finance/labels";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { assignFinanceDoc, setFinanceDepartment } from "./actions";
import { ReferenceList, WorkFilters } from "./finance-list-controls";

export const metadata: Metadata = {
  title: "재무국 업무",
};

// 업무 공간 > 재무국 업무: 양식, 참고 자료, 업무 파일 순서로 보여 준다.
export default function FinancePage(props: PageProps<"/finance">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <FinanceContent searchParams={props.searchParams} />
    </Suspense>
  );
}

const WORK_STATUSES = FINANCE_STATUS_ORDER.filter((status) => status !== "IMPORTED");

const BADGE: Record<FinanceStatus, string> = {
  DRAFT: "bg-coral-50 text-coral-800 dark:bg-coral-900/30 dark:text-coral-300",
  REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  DONE: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  IMPORTED: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

async function FinanceContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const membership = await requireMember("/finance");
  const me = (await getCurrentUserId())!;
  const finance = await getFinanceContext(membership);
  const today = todayInSeoul();

  if (!finance.department) {
    const org = await getTermOrgOptions(membership.termId);
    return (
      <div className="space-y-6">
        <PageHeader title="재무국 업무" />
        {membership.role === "EXECUTIVE" ? (
          <section className="max-w-md space-y-3 rounded-xl border border-zinc-200 bg-surface p-5 dark:border-zinc-800">
            <p className="font-semibold">재무 담당 부서를 정해 주세요</p>
            <p className="text-sm text-muted">이 부서의 국장·국원이 양식과 재무 문서를 다룹니다. 기수마다 한 부서입니다.</p>
            <ActionForm action={setFinanceDepartment} submitLabel="재무 담당으로 정하기">
              <SelectField label="부서" name="department_id" required options={departmentSelectOptions(org.departments)} />
            </ActionForm>
          </section>
        ) : (
          <Alert tone="info">아직 재무 담당 부서가 정해지지 않았습니다. 회장단에게 요청해 주세요.</Alert>
        )}
      </div>
    );
  }
  if (!finance.role) {
    return (
      <div className="space-y-6">
        <PageHeader title="재무국 업무" />
        <Alert tone="info">재무국 구성원과 회장단만 볼 수 있습니다.</Alert>
      </div>
    );
  }

  const raw = await searchParams;
  const tab = WORK_STATUSES.find((s) => s === raw.status) ?? null;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 50) : "";
  const event = FINANCE_EVENTS.find((name) => name === raw.event);
  const sort = raw.sort === "old" ? "old" : "date";
  const href = (s: FinanceStatus | null) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    if (event) p.set("event", event);
    if (sort !== "date") p.set("sort", sort);
    return p.size ? `/finance?${p}` : "/finance";
  };

  const supabase = await createClient();
  const [forms, docs] = await Promise.all([
    supabase.from("finance_forms").select("id, name, sensitive, versions:finance_form_versions(version, file_path, file_name)").eq("term_id", membership.termId).order("created_at"),
    supabase
      .from("finance_docs")
      .select("id, title, semester, base_date, sensitive, is_reference, event_category, first_assignee:profiles!finance_docs_first_assignee_id_fkey(display_name), task:tasks(id, status, assignee_id), form:finance_forms(name)")
      .eq("term_id", membership.termId)
      .order("base_date", { ascending: false })
      .limit(300),
  ]);
  if (forms.error || docs.error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;

  const canManage = finance.role !== "MEMBER";
  // 잘못 지정했을 때 회장단이 바꿀 수 있게(RPC가 기존 지정을 풀고 옮긴다)
  const deptMenu =
    membership.role === "EXECUTIVE" ? (
      <ManageMenu
        title="재무 담당 부서"
        subtitle={finance.department.name}
        items={[
          {
            key: "dept",
            label: "재무 담당 부서 바꾸기",
            content: (
              <ActionForm action={setFinanceDepartment} submitLabel="바꾸기">
                <SelectField label="부서" name="department_id" required options={departmentSelectOptions((await getTermOrgOptions(membership.termId)).departments)} defaultValue={finance.department.id} />
              </ActionForm>
            ),
          },
        ]}
      />
    ) : null;
  const nameOf = (id: string | null | undefined) => (id ? (finance.members.find((m) => m.userId === id)?.name ?? "(지난 구성원)") : null);
  const memberOptions = memberSelectOptions(finance.members);
  const formRows = forms.data
    .map((f) => {
      const latest = [...f.versions].sort((a, b) => b.version - a.version)[0];
      return latest ? { id: f.id, name: f.name, sensitive: f.sensitive, version: latest.version, path: latest.file_path, fileName: latest.file_name } : null;
    })
    .filter((f) => f !== null);

  const references = docs.data.filter((d) => d.is_reference);
  const rows = docs.data.filter((d) => !d.is_reference)
    .map((d) => {
      const task = [d.task].flat()[0] ?? null;
      const status = financeStatus(task?.status ?? "TODO");
      const owner = task ? nameOf(task.assignee_id) : null;
      return { ...d, task, status, owner, author: d.first_assignee?.display_name ?? null, form: [d.form].flat()[0]?.name ?? "—" };
    })
    .filter((d) => (!tab || d.status === tab) && (!event || d.event_category === event) && (!q || d.title.includes(q) || (d.author ?? "").includes(q)))
    .sort((a, b) => sort === "old" ? a.base_date.localeCompare(b.base_date) : b.base_date.localeCompare(a.base_date));

  return (
    <div className="space-y-8">
      <PageHeader
        title="재무국 업무"
        description={`${finance.department.name} · ${semesterOf(today)}학기`}
        actions={
          <span className="flex items-center gap-1">
            {canManage && <RegisterFormButton termId={membership.termId} label="+ 양식 등록" />}
            {deptMenu}
          </span>
        }
      />

      <Section title={`양식 (${formRows.length})`}>
        {formRows.length === 0 ? (
          <p className="text-sm text-muted">{canManage ? "아직 양식이 없습니다. 오른쪽 위 '+ 양식 등록'으로 .xlsx 양식을 올려 주세요." : "아직 등록된 양식이 없습니다."}</p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {formRows.map((f) => (
              <li key={f.id} className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <FormPreviewButton form={f} canAssign={canManage} members={memberOptions} defaultSemester={semesterOf(today)} today={today} />
                </div>
                {canManage && (
                  <ManageMenu
                    title="양식 관리"
                    subtitle={f.name}
                    items={[{ key: "version", label: "새 버전 올리기", content: <RegisterFormButton termId={membership.termId} formId={f.id} label="새 버전 파일 고르기" /> }]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`참고 자료 (${references.length})`} action={canManage && <ImportDocButton termId={membership.termId} defaultSemester={semesterOf(today)} today={today} />}>
        <ReferenceList documents={references.map(({ id, title, sensitive, base_date }) => ({ id, title, sensitive, base_date }))} />
      </Section>

      <Section title={`업무 파일 (${rows.length})`}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <nav aria-label="문서 상태" className="flex flex-wrap gap-1">
            <PillLink href={href(null)} current={tab === null}>
              전체
            </PillLink>
            {WORK_STATUSES.map((s) => (
              <PillLink key={s} href={href(s)} current={tab === s}>
                {FINANCE_STATUS_LABELS[s]}
              </PillLink>
            ))}
          </nav>
          <WorkFilters key={`${sort}:${event ?? ""}`} status={tab} q={q} sort={sort} event={event ?? ""} />
          <Form action="/finance" role="search" aria-label="업무 파일 검색" className="flex max-w-full items-center gap-2">
            {tab && <input type="hidden" name="status" value={tab} />}
            {sort !== "date" && <input type="hidden" name="sort" value={sort} />}
            {event && <input type="hidden" name="event" value={event} />}
            <label htmlFor="finance-q" className="sr-only">제목·작성자 검색</label>
            <input key={q} id="finance-q" name="q" type="search" defaultValue={q} maxLength={50} placeholder="제목·작성자 검색" className={`h-11 w-48 min-w-0 rounded-lg border border-border-input bg-surface px-3 text-sm ${FOCUS_RING}`} />
            <Button type="submit" className="h-11 shrink-0">검색</Button>
          </Form>
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-muted">{q ? `"${q}"에 맞는 문서가 없습니다.` : "문서가 없습니다. 위의 양식을 눌러 업무를 시작하세요."}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {rows.map((d) => {
              const mine = !!d.task && d.task.assignee_id === me;
              return (
                <li key={d.id} className={`flex items-center gap-2 pr-2 ${mine ? "bg-coral-50/50 dark:bg-coral-900/10" : ""}`}>
                  <Link href={`/finance/docs/${d.id}`} className={`flex min-w-0 flex-1 flex-col gap-1.5 p-4 hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{d.title}</span>
                      {mine && <span className="rounded-full bg-danger-bg px-2 py-0.5 text-xs font-bold text-danger">나에게 배정된</span>}
                      {d.sensitive && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">민감</span>}
                    </span>
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${BADGE[d.status]}`}>{FINANCE_STATUS_LABELS[d.status]}</span>
                      <span>{d.form}</span>
                      {d.event_category && <span>{d.event_category}</span>}
                      {d.author && <span>작성 {d.author}</span>}
                      {d.task && (d.owner ? <span>담당 {d.owner}</span> : <span className="font-bold text-danger">미배정</span>)}
                      <span className="tabular-nums">
                        {d.semester} · 기준일 {d.base_date}
                      </span>
                    </span>
                  </Link>
                  {canManage && d.task && d.status === "DRAFT" && (
                    <ManageMenu
                      title="문서 관리"
                      subtitle={d.title}
                      items={[
                        {
                          key: "assign",
                          label: d.owner ? "담당자 바꾸기" : "담당자 지정",
                          content: (
                            <ActionForm action={assignFinanceDoc} submitLabel="저장">
                              <input type="hidden" name="doc_id" value={d.id} />
                              <SelectField label="담당자" name="assignee_id" options={memberOptions} placeholder="미배정" defaultValue={d.task.assignee_id ?? ""} />
                            </ActionForm>
                          ),
                        },
                      ]}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-xs text-muted">일반 문서는 재무국 구성원과 회장단이 볼 수 있습니다. 민감 문서는 재무국장·회장단·생성자·담당자가 볼 수 있습니다.</p>
      </Section>
    </div>
  );
}
