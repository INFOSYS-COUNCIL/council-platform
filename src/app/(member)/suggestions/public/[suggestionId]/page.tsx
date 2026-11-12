import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { SuggestionStatusBadge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "공개 건의",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function PublicSuggestionPage(props: PageProps<"/suggestions/public/[suggestionId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <PublicSuggestion params={props.params} />
    </Suspense>
  );
}

async function PublicSuggestion({ params }: { params: Promise<{ suggestionId: string }> }) {
  const { suggestionId } = await params;
  await requireUser(`/suggestions/public/${suggestionId}`);
  if (!UUID.test(suggestionId)) notFound();

  const supabase = await createClient();
  const [{ data: s, error }, { data: answers, error: answersError }] = await Promise.all([
    // 공개 건의만 연다. 처리자는 RLS로 다른 건의도 보이므로 공개 여부를 여기서도 확인한다
    supabase
      .from("suggestions")
      .select("id, title, content, status, created_at")
      .eq("id", suggestionId)
      .eq("visibility", "PUBLIC")
      .is("withdrawn_at", null)
      .maybeSingle(),
    // 내부 메모는 빼고 공개 답변만. 답한 사람 이름도 보이지 않는다
    supabase
      .from("suggestion_messages")
      .select("id, body, created_at, updated_at")
      .eq("suggestion_id", suggestionId)
      .eq("message_type", "AUTHOR_VISIBLE")
      .order("created_at"),
  ]);
  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  if (!s) notFound();

  return (
    <div className="space-y-8">
      <PageHeader
        title={s.title}
        description={`${new Date(s.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} · 작성자 비공개`}
        actions={<SuggestionStatusBadge status={s.status} />}
      />
      <p>
        <SecondaryLinkButton href="/suggestions/public">← 모두의 건의</SecondaryLinkButton>
      </p>
      <Section title="내용">
        <p className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">{s.content}</p>
      </Section>
      <Section title="학생회 답변">
        {answersError ? (
          <Alert>답변을 불러오지 못했습니다. 새로고침해 주세요.</Alert>
        ) : !answers || answers.length === 0 ? (
          <p className="text-sm">아직 답변이 없습니다.</p>
        ) : (
          <ol className="space-y-3">
            {answers.map((a) => (
              <li key={a.id} className="rounded-md border-l-4 border-coral-500 bg-coral-50 p-3 dark:bg-zinc-900">
                <p className="whitespace-pre-wrap">{a.body}</p>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                  {new Date(a.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", dateStyle: "short", timeStyle: "short" })}
                  {a.updated_at && " · 수정됨"}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}
