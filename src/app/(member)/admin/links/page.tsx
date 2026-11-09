import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { TextField } from "@/components/ui/form-field";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createLink, deleteLink, toggleLink } from "./actions";

export const metadata: Metadata = {
  title: "바로가기",
};

const ROUTE = ADMIN_ROUTES.links;

// 대시보드 바로가기(기획서 3.2절). 기수와 무관하게 유지되는 전역 설정이며 회장단만 관리한다.
export default function LinksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="바로가기" description="대시보드에 보이는 외부 서비스 링크입니다. 기수가 바뀌어도 유지됩니다." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LinksContent />
      </Suspense>
    </div>
  );
}

async function LinksContent() {
  await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboard_links")
    .select("id, name, url, description, sort_order, is_active")
    .order("sort_order")
    .order("name");

  return (
    <>
      {error ? (
        <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>
      ) : data.length === 0 ? (
        <p className="text-sm">아직 바로가기가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.map((link) => (
            <li key={link.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="min-w-0">
                <span className="font-medium">{link.name}</span> {!link.is_active && <Badge tone="muted">숨김</Badge>}
                <span className="block truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {link.sort_order} · {link.url}
                </span>
              </span>
              <span className="flex gap-2">
                <ActionForm action={toggleLink} submitLabel={link.is_active ? "숨기기" : "보이기"} variant="secondary">
                  <input type="hidden" name="link_id" value={link.id} />
                  <input type="hidden" name="active" value={String(!link.is_active)} />
                </ActionForm>
                <ActionForm action={deleteLink} submitLabel="지우기" variant="secondary" confirmMessage={`"${link.name}" 바로가기를 지울까요?`}>
                  <input type="hidden" name="link_id" value={link.id} />
                </ActionForm>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Section title="바로가기 추가">
        <ActionForm action={createLink} submitLabel="추가">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="이름" name="name" required maxLength={50} placeholder="학생회 Instagram" />
            <TextField label="주소" name="url" type="url" required pattern="https://.+" placeholder="https://" />
            <TextField label="설명" name="description" maxLength={200} />
            <TextField label="순서" name="sort_order" type="number" defaultValue="0" hint="작은 숫자가 앞에 옵니다." />
          </div>
        </ActionForm>
      </Section>
    </>
  );
}
