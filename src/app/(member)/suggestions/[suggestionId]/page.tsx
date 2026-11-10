import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { SUGGESTION_STATUS_LABELS } from "@/lib/suggestions/labels";
import { withdrawSuggestion } from "../actions";

export const metadata: Metadata = {
  title: "건의 상세",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SuggestionPage(props: PageProps<"/suggestions/[suggestionId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <SuggestionDetail params={props.params} />
    </Suspense>
  );
}

async function SuggestionDetail({ params }: { params: Promise<{ suggestionId: string }> }) {
  const { suggestionId } = await params;
  const me = await requireUser(`/suggestions/${suggestionId}`);
  if (!UUID.test(suggestionId)) notFound();

  const supabase = await createClient();
  // 작성자 화면: 내가 쓴 건의만 연다. 처리자는 /council/suggestions에서 본다
  const { data: own } = await supabase
    .from("suggestion_authors")
    .select("suggestion_id")
    .eq("suggestion_id", suggestionId)
    .eq("author_user_id", me)
    .maybeSingle();
  if (!own) notFound();

  const [{ data: s, error }, { data: answers }] = await Promise.all([
    supabase.from("suggestions").select("id, title, content, status, created_at, withdrawn_at").eq("id", suggestionId).single(),
    // 작성자에게는 RLS가 공개 답변만 돌려준다(내부 메모 제외)
    supabase.from("suggestion_messages").select("id, body, created_at, updated_at").eq("suggestion_id", suggestionId).order("created_at"),
  ]);
  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;

  return (
    <div className="space-y-8">
      <PageHeader
        title={s.title}
        description={`${new Date(s.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })} 제출`}
        actions={<Badge tone={s.status === "RESOLVED" ? "strong" : "neutral"}>{SUGGESTION_STATUS_LABELS[s.status]}</Badge>}
      />
      <p>
        <SecondaryLinkButton href="/suggestions">
          ← 내 건의
        </SecondaryLinkButton>
      </p>
      {s.withdrawn_at && <Alert tone="info">철회한 건의입니다.</Alert>}

      <Section title="내용">
        <p className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">{s.content}</p>
      </Section>

      <Section title="학생회 답변">
        {!answers || answers.length === 0 ? (
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

      {s.status === "RECEIVED" && (
        <ActionForm
          action={withdrawSuggestion}
          submitLabel="건의 철회"
          variant="secondary"
          confirmMessage="건의를 철회하면 되돌릴 수 없습니다. 철회할까요?"
        >
          <input type="hidden" name="suggestion_id" value={s.id} />
        </ActionForm>
      )}
    </div>
  );
}
