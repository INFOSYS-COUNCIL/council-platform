import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/detail";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { NewSuggestionForm } from "./new-suggestion-form";

export const metadata: Metadata = {
  title: "건의하기",
};

export default function NewSuggestionPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="건의하기" />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <NewSuggestion />
      </Suspense>
    </div>
  );
}

async function NewSuggestion() {
  await requireUser("/suggestions/new");
  // 화면을 열 때마다 새 요청 번호. 같은 폼을 두 번 제출해도 건의는 하나만 생긴다
  return <NewSuggestionForm requestId={crypto.randomUUID()} />;
}
