import { PhotoTags } from "./photo-tags";
import type { ReactNode } from "react";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/detail";

export function PhotoDetail({
  title,
  description,
  tags = [],
  children,
  actions,
}: {
  title: string;
  description: string;
  tags?: string[];
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <SecondaryLinkButton href="/photos">과 활동 목록으로</SecondaryLinkButton>
      <PageHeader title={title} actions={actions} />
      {(description || tags.length > 0) && (
        <div className="rounded-2xl border border-[#dfcdbd] bg-[#fff8f0] text-[#2a1a15] p-5 shadow-sm sm:p-6">
          <Section title="활동 소개">
            {description && <p className="whitespace-pre-wrap break-words text-base leading-8 text-[#2a1a15]">
              {description}
            </p>}
            <PhotoTags tags={tags} onPaper />
          </Section>
        </div>
      )}
      <div className="min-w-0 rounded-2xl border border-[#dfcdbd] bg-[#fff8f0] text-[#2a1a15] p-4 shadow-sm sm:p-6">
        <Section title="과 활동">{children}</Section>
      </div>
    </article>
  );
}
