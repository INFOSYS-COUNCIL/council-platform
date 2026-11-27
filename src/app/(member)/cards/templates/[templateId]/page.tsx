import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { ManageMenu } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { parseLayouts } from "@/lib/cards/model";
import { getCouncilName } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { deleteTemplate } from "../../actions";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = {
  title: "카드뉴스 틀",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TemplatePage(props: PageProps<"/cards/templates/[templateId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <TemplateDetail params={props.params} />
    </Suspense>
  );
}

async function TemplateDetail({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  const membership = await requireMember(`/cards/templates/${templateId}`, ["DIRECTOR", "EXECUTIVE"]);
  if (!UUID.test(templateId)) notFound();
  const supabase = await createClient();
  const [{ data }, councilName] = await Promise.all([
    supabase.from("card_templates").select("id, name, width, height, background_color, background_path, font_path, layouts, term_id").eq("id", templateId).maybeSingle(),
    getCouncilName(),
  ]);
  if (!data) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        description="템플릿(표지·본문·달력 등)마다 배경과 요소를 배치합니다. '카드뉴스에서 고칠 수 있음'을 끈 요소는 틀에 고정됩니다."
        actions={
          <ManageMenu
            title="틀 관리"
            subtitle={data.name}
            items={[
              {
                key: "delete",
                label: "삭제",
                danger: true,
                content: (
                  <ActionForm action={deleteTemplate} submitLabel="삭제">
                    <input type="hidden" name="template_id" value={data.id} />
                    <p className="text-sm">이 틀을 지웁니다. 이 틀로 만든 카드뉴스가 있으면 지울 수 없습니다.</p>
                  </ActionForm>
                ),
              },
            ]}
          />
        }
      />
      <p>
        <SecondaryLinkButton href="/cards">← 카드뉴스</SecondaryLinkButton>
      </p>
      <TemplateEditor termId={data.term_id ?? membership.termId} councilName={councilName} initial={{ ...data, layouts: parseLayouts(data.layouts) }} />
    </div>
  );
}
