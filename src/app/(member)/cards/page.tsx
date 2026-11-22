import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Section, Skeleton } from "@/components/ui/detail";
import { DialogButton } from "@/components/ui/dialog-button";
import { SelectField, TextField } from "@/components/ui/form-field";
import { FOCUS_RING } from "@/components/ui/link-button";
import { ManageMenu } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { CARD_SIZES } from "@/lib/cards/model";
import { formatDateTime, todayInSeoul } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { createCard, createTemplate, deleteCard } from "./actions";

export const metadata: Metadata = {
  title: "카드뉴스",
};

// 기록 > 카드뉴스: 국장 이상이 만든 틀(크기·배경·글꼴·배치)로 카드뉴스를 만들어 PNG·JPEG로 내려받는다.
export default function CardsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="카드뉴스" />
      <Suspense fallback={<Skeleton />}>
        <CardsContent />
      </Suspense>
    </div>
  );
}

const ROW = `flex min-w-0 flex-1 flex-col gap-1 p-4 hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`;
const LIST = "divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900";

async function CardsContent() {
  const membership = await requireMember("/cards");
  const me = await getCurrentUserId();
  const supabase = await createClient();
  const [templates, cards] = await Promise.all([
    supabase.from("card_templates").select("id, name, width, height").eq("term_id", membership.termId).order("created_at"),
    supabase
      .from("card_news")
      .select("id, title, updated_at, created_by, template:card_templates(name)")
      .eq("term_id", membership.termId)
      .order("updated_at", { ascending: false })
      .limit(100),
  ]);
  if (templates.error || cards.error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const isDirector = membership.role !== "MEMBER";
  const today = todayInSeoul();
  const templateOptions = templates.data.map((t) => ({ value: t.id, label: `${t.name} (${t.width}×${t.height})` }));

  return (
    <div className="space-y-10">
      <Section
        title="카드뉴스"
        action={
          templateOptions.length > 0 && (
            <DialogButton label="+ 새 카드뉴스">
              <ActionForm action={createCard} submitLabel="만들고 편집하기">
                <TextField label="제목" name="title" required maxLength={100} hint="예: 사물함 정리 안내" />
                <SelectField label="틀" name="template_id" required options={templateOptions} defaultValue={templateOptions[0]?.value} />
              </ActionForm>
            </DialogButton>
          )
        }
      >
        {templateOptions.length === 0 ? (
          <p className="text-sm text-muted">{isDirector ? "먼저 아래에서 틀을 만들어 주세요." : "아직 틀이 없습니다. 국장이나 회장단이 틀을 만들면 카드뉴스를 만들 수 있습니다."}</p>
        ) : cards.data.length === 0 ? (
          <p className="text-sm text-muted">아직 만든 카드뉴스가 없습니다.</p>
        ) : (
          <ul className={LIST}>
            {cards.data.map((c) => (
              <li key={c.id} className="flex items-center gap-2 pr-2">
                <Link href={`/cards/${c.id}`} className={ROW}>
                  <span className="truncate font-semibold">{c.title}</span>
                  <span className="text-sm text-muted">
                    {[c.template].flat()[0]?.name} · {formatDateTime(c.updated_at, today)}
                  </span>
                </Link>
                {(isDirector || c.created_by === me) && (
                  <ManageMenu
                    title="카드뉴스 관리"
                    subtitle={c.title}
                    items={[
                      {
                        key: "delete",
                        label: "삭제",
                        danger: true,
                        content: (
                          <ActionForm action={deleteCard} submitLabel="삭제">
                            <input type="hidden" name="card_id" value={c.id} />
                            <p className="text-sm">이 카드뉴스를 지웁니다. 되돌릴 수 없습니다.</p>
                          </ActionForm>
                        ),
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title="틀"
        action={
          isDirector && (
            <DialogButton label="+ 새 틀">
              <ActionForm action={createTemplate} submitLabel="만들고 꾸미기">
                <TextField label="틀 이름" name="name" required maxLength={60} hint="예: 16대 공지 카드뉴스" />
                <SelectField label="크기" name="size" options={CARD_SIZES.map((s, i) => ({ value: String(i), label: s.label }))} defaultValue="0" />
              </ActionForm>
            </DialogButton>
          )
        }
      >
        {templates.data.length === 0 ? (
          <p className="text-sm text-muted">아직 틀이 없습니다.</p>
        ) : (
          <ul className={LIST}>
            {templates.data.map((t) => (
              <li key={t.id} className="flex items-center gap-2 pr-2">
                {isDirector ? (
                  <Link href={`/cards/templates/${t.id}`} className={ROW}>
                    <span className="truncate font-semibold">{t.name}</span>
                    <span className="text-sm text-muted">
                      {t.width}×{t.height} · 눌러서 꾸미기
                    </span>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 p-4">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-sm text-muted">
                      {t.width}×{t.height}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
