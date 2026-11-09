import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { TextField } from "@/components/ui/form-field";
import { ManageMenu } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createLink, deleteLink, toggleLink, updateLink } from "./actions";

export const metadata: Metadata = {
  title: "대시보드 바로가기",
};

const ROUTE = ADMIN_ROUTES.links;

// 대시보드 바로가기(기획서 3.2절). 기수와 무관하게 유지되는 전역 설정이며 회장단만 관리한다.
export default function LinksPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="대시보드 바로가기" description="대시보드에 보이는 외부 서비스 링크입니다. 기수가 바뀌어도 유지됩니다." />
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
              <ManageMenu
                title="바로가기 관리"
                subtitle={link.name}
                items={[
                  {
                    key: "edit",
                    label: "수정",
                    content: (
                      <ActionForm action={updateLink} submitLabel="수정 저장">
                        <input type="hidden" name="link_id" value={link.id} />
                        <TextField id={`name-${link.id}`} label="이름" name="name" required maxLength={50} defaultValue={link.name} />
                        <TextField id={`url-${link.id}`} label="주소" name="url" type="url" required pattern="https://.+" defaultValue={link.url} />
                        <TextField id={`desc-${link.id}`} label="설명" name="description" maxLength={200} defaultValue={link.description} />
                        <TextField id={`order-${link.id}`} label="순서" name="sort_order" type="number" defaultValue={String(link.sort_order)} hint="작은 숫자가 앞에 옵니다." />
                      </ActionForm>
                    ),
                  },
                  {
                    key: "toggle",
                    label: link.is_active ? "대시보드에서 숨기기" : "대시보드에 다시 보이기",
                    content: (
                      <ActionForm action={toggleLink} submitLabel={link.is_active ? "숨기기" : "보이기"}>
                        <p className="text-sm">{link.is_active ? "대시보드에서 숨깁니다. 언제든 다시 보이게 할 수 있습니다." : "대시보드에 다시 보이게 합니다."}</p>
                        <input type="hidden" name="link_id" value={link.id} />
                        <input type="hidden" name="active" value={String(!link.is_active)} />
                      </ActionForm>
                    ),
                  },
                  {
                    key: "delete",
                    label: "삭제",
                    danger: true,
                    content: (
                      <ActionForm action={deleteLink} submitLabel="삭제">
                        <p className="text-sm">이 바로가기를 완전히 지웁니다. 되돌릴 수 없습니다.</p>
                        <input type="hidden" name="link_id" value={link.id} />
                      </ActionForm>
                    ),
                  },
                ]}
              />
            </li>
          ))}
        </ul>
      )}

      <Section title="새 바로가기 추가">
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
