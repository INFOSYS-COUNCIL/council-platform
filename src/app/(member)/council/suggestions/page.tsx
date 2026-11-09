import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { pageNumber, Pagination, PillLink } from "@/components/ui/pagination";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  SUGGESTION_STATUS_LABELS,
  SUGGESTION_STATUS_ORDER,
  type SuggestionStatus,
} from "@/lib/suggestions/labels";

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
    .select("id, title, status, created_at, department:departments(name)", { count: "exact" })
    .eq("term_id", membership.termId);
  if (status) query = query.eq("status", status);
  const from = (page - 1) * PER_PAGE;
  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + PER_PAGE - 1);

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
            <li key={s.id}>
              <Link href={`/council/suggestions/${s.id}`} className={`flex items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.title}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(s.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · {s.department?.name ?? "미배정"}
                  </span>
                </span>
                <Badge tone={s.status === "RECEIVED" ? "strong" : "neutral"}>{SUGGESTION_STATUS_LABELS[s.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => href(status, p)} />
    </>
  );
}
