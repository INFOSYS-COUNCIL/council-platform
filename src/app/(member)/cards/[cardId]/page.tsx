import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { parseLayouts, parseSlides } from "@/lib/cards/model";
import { createClient } from "@/lib/supabase/server";
import { CardEditor } from "./card-editor";

export const metadata: Metadata = {
  title: "카드뉴스 만들기",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CardPage(props: PageProps<"/cards/[cardId]">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <CardDetail params={props.params} />
    </Suspense>
  );
}

async function CardDetail({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const membership = await requireMember(`/cards/${cardId}`);
  if (!UUID.test(cardId)) notFound();
  const me = await getCurrentUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("card_news")
    .select("id, title, slides, created_by, template:card_templates(id, name, width, height, background_color, background_path, font_path, layouts)")
    .eq("id", cardId)
    .maybeSingle();
  const template = data && [data.template].flat()[0];
  if (!data || !template) notFound();
  // 표시용. 실제 검사는 save_card_news가 한다(만든 사람 또는 국장 이상)
  const canEdit = data.created_by === me || membership.role !== "MEMBER";

  return (
    <div className="space-y-6">
      <PageHeader title={data.title} description={`틀: ${template.name} (${template.width}×${template.height})`} />
      <p>
        <SecondaryLinkButton href="/cards">← 카드뉴스</SecondaryLinkButton>
      </p>
      <CardEditor
        cardId={data.id}
        initialTitle={data.title}
        initialSlides={parseSlides(data.slides)}
        template={{ ...template, layouts: parseLayouts(template.layouts) }}
        canEdit={canEdit}
      />
    </div>
  );
}
