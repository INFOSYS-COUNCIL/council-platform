import type { ReactNode } from "react";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";

export function PhotoDetail({
  title,
  description,
  children,
  actions,
}: {
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-4xl space-y-6">
      <SecondaryLinkButton href="/photos">활동 사진 목록으로</SecondaryLinkButton>
      <PageHeader title={title} actions={actions} />
      {description && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
          {description}
        </p>
      )}
      {children}
    </article>
  );
}
