import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { toggleTemplate } from "./actions";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = {
  title: "회의록 Template | 학생회 운영 플랫폼",
};

const ROUTE = ADMIN_ROUTES.templates;

// 회의록 Template (기획서 6.7절). 기수에 속하며 새 기수로 복제하지 않는다. 회장단만 관리한다.
export default function TemplatesPage(props: PageProps<"/admin/templates">) {
  return (
    <div className="space-y-6">
      <PageHeader title="회의록 Template" description="새 회의록을 만들 때 처음 들어가는 본문입니다. 이번 기수에만 쓰입니다." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <TemplatesContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function TemplatesContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const { edit } = await searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meeting_templates")
    .select("id, name, blocks, is_active")
    .eq("term_id", membership.termId)
    .order("is_active", { ascending: false })
    .order("name");
  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const editing = data.find((t) => t.id === edit);

  return (
    <>
      {data.length === 0 ? (
        <p className="text-sm">아직 Template이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="font-medium">
                {t.name} {!t.is_active && <Badge tone="muted">사용 안 함</Badge>}
              </span>
              <span className="flex items-center gap-3">
                <Link href={`${ROUTE.href}?edit=${t.id}`} className={`text-sm underline ${FOCUS_RING}`}>
                  수정
                </Link>
                <ActionForm action={toggleTemplate} submitLabel={t.is_active ? "사용 안 함" : "다시 사용"} variant="secondary">
                  <input type="hidden" name="template_id" value={t.id} />
                  <input type="hidden" name="active" value={String(!t.is_active)} />
                </ActionForm>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Section title={editing ? `"${editing.name}" 수정` : "새 Template"}>
        {editing && (
          <Link href={ROUTE.href} className={`text-sm underline ${FOCUS_RING}`}>
            수정 그만두고 새로 만들기
          </Link>
        )}
        {/* key: 다른 Template을 고르면 편집기를 새로 만든다 */}
        <TemplateForm key={editing?.id ?? "new"} templateId={editing?.id} name={editing?.name ?? ""} blocks={editing?.blocks ?? []} />
      </Section>
    </>
  );
}
