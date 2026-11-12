import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { SuggestionStatusBadge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "모두의 건의",
};

// 작성자가 "전체 공개"로 낸 건의. 로그인한 학생 누구나 본다(작성자 이름은 숨김).
export default function PublicSuggestionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="모두의 건의"
        description="학생들이 전체 공개로 남긴 건의와 학생회 답변입니다. 작성자 이름은 보이지 않습니다."
      />
      <Suspense fallback={<Skeleton className="h-48" />}>
        <PublicSuggestions />
      </Suspense>
    </div>
  );
}

async function PublicSuggestions() {
  await requireUser("/suggestions/public");
  const supabase = await createClient();
  // 처리자는 RLS로 학생회만 건의도 보이므로 공개 건의만 고른다
  // shortcut: 쪽 나누기 없이 최근 100건. 공개 건의가 많아지면 쪽 이동을 붙인다
  const { data, error } = await supabase
    .from("suggestions")
    .select("id, title, status, created_at")
    .eq("visibility", "PUBLIC")
    .is("withdrawn_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  if (data.length === 0) return <EmptyState title="아직 공개된 건의가 없습니다." />;

  return (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {data.map((s) => (
        <li key={s.id}>
          <Link href={`/suggestions/public/${s.id}`} className={`flex items-center justify-between gap-3 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{s.title}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                {new Date(s.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}
              </span>
            </span>
            <SuggestionStatusBadge status={s.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
