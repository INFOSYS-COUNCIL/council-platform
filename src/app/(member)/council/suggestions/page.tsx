import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/form-field";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { pageNumber, Pagination, PillLink } from "@/components/ui/pagination";
import { ManageMenu, type ManageItem } from "@/components/ui/manage-menu";
import { requireMember } from "@/lib/auth/session";
import { departmentSelectOptions, getTermOrgOptions, memberSelectOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import {
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_ORDER,
  type SuggestionStatus,
} from "@/lib/suggestions/labels";
import { assignSuggestion, changeSuggestionStatus, deleteSuggestion } from "../../suggestions/actions";

export const metadata: Metadata = {
  title: "건의 처리",
};

const PER_PAGE = 20;

// 회장단은 기수 전체, 국장은 자기 국에 배정된 건, 국원은 직접 배정된 건만 RLS가 돌려준다(D-11).
export default function CouncilSuggestionsPage(props: PageProps<"/council/suggestions">) {
  return (
    <div className="space-y-6">
      <PageHeader title="건의 처리" description="작성자 신원은 회장단 화면에만 보입니다." />
      <Suspense fallback={<Skeleton />}>
        <CouncilSuggestions searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function CouncilSuggestions({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireMember("/council/suggestions");
  const raw = await searchParams;
  const status: SuggestionStatus | null = SUGGESTION_STATUS_ORDER.find((s) => s === raw.status) ?? null;
  const page = pageNumber(raw.page);
  const href = (s: SuggestionStatus | null, p = 1) => {
    const q = new URLSearchParams();
    if (s) q.set("status", s);
    if (p > 1) q.set("page", String(p));
    return q.size ? `/council/suggestions?${q}` : "/council/suggestions";
  };

  const supabase = await createClient();
  let query = supabase
    .from("suggestions")
    .select("id, title, status, created_at, withdrawn_at, assigned_department_id, assigned_user_id, department:departments(name)", { count: "exact" })
    .eq("term_id", membership.termId);
  if (status) query = query.eq("status", status);
  const from = (page - 1) * PER_PAGE;
  const isExecutive = membership.role === "EXECUTIVE";
  // 삭제: 회장단 또는 맡은 국의 국장(DB 함수가 다시 검사)
  const canDelete = (s: { assigned_department_id: string | null }) =>
    isExecutive || (membership.role === "DIRECTOR" && s.assigned_department_id === membership.departmentId);
  const [{ data, count, error }, org] = await Promise.all([
    query.order("created_at", { ascending: false }).range(from, from + PER_PAGE - 1),
    // 배정은 회장단만 하므로 부서·구성원 목록도 회장단일 때만 부른다
    isExecutive ? getTermOrgOptions(membership.termId) : null,
  ]);

  return (
    <>
      <nav aria-label="상태로 거르기" className="flex flex-wrap gap-2">
        {[null, ...SUGGESTION_STATUS_ORDER].map((s) => (
          <PillLink key={s ?? "all"} href={href(s)} current={s === status}>
            {s ? SUGGESTION_STATUS_LABELS[s] : "전체"}
          </PillLink>
        ))}
      </nav>
      {error ? (
        <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>
      ) : data.length === 0 ? (
        <EmptyState title="처리할 건의가 없습니다." />
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.map((s) => (
            <li key={s.id} className="flex items-center gap-1 pr-2">
              <Link href={`/council/suggestions/${s.id}`} className={`flex min-w-0 flex-1 items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · {s.department?.name ?? "미배정"}
                  </span>
                </span>
                <Badge tone={s.status === "RECEIVED" ? "strong" : "neutral"}>{SUGGESTION_STATUS_LABELS[s.status]}</Badge>
              </Link>
              {/* 답변·메모 수정은 상세 화면에서 */}
              <ManageMenu title="건의 처리" subtitle={s.title} items={suggestionItems(s, org, canDelete(s))} />
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => href(status, p)} />
    </>
  );
}

// 목록 ⋯ 관리: 삭제(회장단·맡은 국 국장)를 맨 위에, 그다음 상태 바꾸기·배정(회장단).
// 철회된 건의는 상태·배정을 바꾸지 않는다. 학생이 쓴 내용은 고치지 않는다. 권한은 DB 함수가 다시 검사한다.
function suggestionItems(
  s: { id: string; status: SuggestionStatus; withdrawn_at: string | null; assigned_department_id: string | null; assigned_user_id: string | null },
  org: Awaited<ReturnType<typeof getTermOrgOptions>> | null,
  canDelete: boolean,
): ManageItem[] {
  const hidden = <input type="hidden" name="suggestion_id" value={s.id} />;
  const items: ManageItem[] = [];
  if (canDelete) {
    items.push({
      key: "delete",
      label: "삭제",
      danger: true,
      content: (
        <ActionForm action={deleteSuggestion} submitLabel="삭제">
          {hidden}
          <p className="text-sm">이 건의와 답변·메모를 모두 지웁니다. 작성자 화면에서도 사라지고 되돌릴 수 없습니다.</p>
        </ActionForm>
      ),
    });
  }
  if (s.withdrawn_at) return items;
  items.push(
    {
      key: "status",
      label: "상태 바꾸기",
      content: (
        <ActionForm action={changeSuggestionStatus} submitLabel="상태 바꾸기">
          {hidden}
          <SelectField
            label="상태"
            name="status"
            defaultValue={s.status}
            options={SUGGESTION_STATUS_ORDER.map((st) => ({ value: st, label: SUGGESTION_STATUS_LABELS[st] }))}
            hint="답변 완료·마감 전에 작성자 공개 답변이 하나 이상 있어야 합니다."
          />
        </ActionForm>
      ),
    },
  );
  if (org) {
    items.push({
      key: "assign",
      label: "담당 배정",
      content: (
        <ActionForm action={assignSuggestion} submitLabel="배정 저장">
          {hidden}
          <SelectField label="담당 부서" name="department_id" placeholder="미배정" options={departmentSelectOptions(org.departments)} defaultValue={s.assigned_department_id ?? ""} />
          <SelectField label="담당자" name="user_id" placeholder="부서 국장이 처리" options={memberSelectOptions(org.members)} defaultValue={s.assigned_user_id ?? ""} />
        </ActionForm>
      ),
    });
  }
  return items;
}
