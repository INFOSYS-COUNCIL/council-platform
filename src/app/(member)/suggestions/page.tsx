import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { SuggestionStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTION_VISIBILITY } from "@/lib/suggestions/labels";

export const metadata: Metadata = {
  title: "내 건의",
};

// 로그인한 학생 누구나. 알림이 없으므로 여기서 처리 상태를 확인한다(기획서 13.2절).
export default function MySuggestionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="내 건의"
        description="학생회에 남긴 건의와 처리 상태를 확인합니다."
      />
      <Suspense fallback={<Skeleton className="h-48" />}>
        <MySuggestions />
      </Suspense>
      {/* 건의하기는 이 화면에만 둔다. 목록 박스와 같은 폭으로 바로 아래에 */}
      <LinkButton href="/suggestions/new" className="min-h-14 w-full text-base">
        건의하기
      </LinkButton>
    </div>
  );
}

async function MySuggestions() {
  const me = await requireUser("/suggestions");
  const supabase = await createClient();
  // 내가 쓴 건의만: 작성자 표는 본인 행만 보인다
  // shortcut: 쪽 나누기 없이 최근 100건. 한 학생이 기수 안에 100건을 넘기면 쪽 이동을 붙인다
  const { data, error } = await supabase
    .from("suggestion_authors")
    .select("suggestion:suggestions(id, title, status, created_at, visibility)")
    .eq("author_user_id", me)
    .limit(100);

  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const rows = data
    .flatMap((r) => (r.suggestion ? [r.suggestion] : []))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (rows.length === 0) return <EmptyState title="아직 건의가 없습니다." />;

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {rows.map((s) => (
        <li key={s.id}>
          <Link href={`/suggestions/${s.id}`} className={`flex items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{s.title}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                {new Date(s.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 제출 · {SUGGESTION_VISIBILITY[s.visibility === "PUBLIC" ? "PUBLIC" : "COUNCIL"].label}
              </span>
            </span>
            <SuggestionStatusBadge status={s.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
