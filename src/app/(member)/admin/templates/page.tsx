import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { ManageMenu } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { deleteTemplate, toggleTemplate } from "./actions";
import { TemplateForm } from "./template-form";

export const metadata: Metadata = {
  title: "회의록 템플릿",
};

const ROUTE = ADMIN_ROUTES.templates;

// 회의록 Template (기획서 6.7절). 기수에 속하며 새 기수로 복제하지 않는다. 회장단만 관리한다.
export default function TemplatesPage(props: PageProps<"/admin/templates">) {
  return (
    <div className="space-y-6">
      <PageHeader title="회의록 템플릿" description="새 회의록을 만들 때 처음 들어가는 본문입니다. 이번 기수에만 쓰입니다." />
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
        <p className="text-sm">아직 템플릿이 없습니다. 아래에서 새 템플릿을 만들어 주세요.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <span className="font-medium">
                {t.name} {!t.is_active && <Badge tone="muted">사용 중지</Badge>}
              </span>
              <ManageMenu
                title="템플릿 관리"
                subtitle={t.name}
                items={[
                  {
                    key: "edit",
                    label: "수정",
                    content: (
                      <div className="space-y-3">
                        <p className="text-sm">아래 편집 화면에서 이름과 본문을 고칩니다.</p>
                        <LinkButton href={`${ROUTE.href}?edit=${t.id}#template-editor`}>수정 화면 열기</LinkButton>
                      </div>
                    ),
                  },
                  {
                    key: "toggle",
                    label: t.is_active ? "사용 중지" : "다시 사용",
                    content: (
                      <ActionForm action={toggleTemplate} submitLabel={t.is_active ? "사용 중지" : "다시 사용"}>
                        <p className="text-sm">
                          {t.is_active ? "새 회의록을 만들 때 이 템플릿이 목록에 보이지 않게 합니다." : "새 회의록을 만들 때 다시 고를 수 있게 합니다."}
                        </p>
                        <input type="hidden" name="template_id" value={t.id} />
                        <input type="hidden" name="active" value={String(!t.is_active)} />
                      </ActionForm>
                    ),
                  },
                  {
                    key: "delete",
                    label: "삭제",
                    danger: true,
                    content: (
                      <ActionForm action={deleteTemplate} submitLabel="삭제">
                        <p className="text-sm">템플릿을 완전히 지웁니다. 이 템플릿으로 만든 회의록이 있으면 지울 수 없고, 대신 사용 중지할 수 있습니다.</p>
                        <input type="hidden" name="template_id" value={t.id} />
                      </ActionForm>
                    ),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      <Section title={editing ? `"${editing.name}" 수정` : "새 템플릿 만들기"}>
        <span id="template-editor" />
        {editing && (
          <Link href={ROUTE.href} className={`inline-flex min-h-9 items-center rounded-md border border-zinc-300 px-3 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
            ← 수정 그만두고 새로 만들기
          </Link>
        )}
        {/* key: 다른 Template을 고르면 편집기를 새로 만든다 */}
        <TemplateForm key={editing?.id ?? "new"} templateId={editing?.id} name={editing?.name ?? ""} blocks={editing?.blocks ?? []} />
      </Section>
    </>
  );
}
