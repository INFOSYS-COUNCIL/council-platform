import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PillLink, pageNumber } from "@/components/ui/pagination";
import { TextField } from "@/components/ui/form-field";
import { Button } from "@/components/ui/button";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { parsePhotoTags, photoTagHref } from "@/lib/photos/content";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveMembership, requireUser } from "@/lib/auth/session";
import { PHOTO_MANAGER_ROLES } from "@/lib/photos/content";
import { getPhotoList } from "@/lib/photos/queries";
import { PhotoListPages } from "./photo-list-pages";
import PhotosLoading from "./loading";

export const metadata: Metadata = { title: "과 활동" };

export default function PhotosPage({ searchParams }: PageProps<"/photos">) {
  return <Suspense fallback={<PhotosLoading />}><PhotosContent searchParams={searchParams} /></Suspense>;
}

async function PhotosContent({ searchParams }: { searchParams: PageProps<"/photos">["searchParams"] }) {
  await requireUser("/photos");
  const params = await searchParams;
  const requestedPage = pageNumber(params.page);
  const rawTag = params.tag;
  const rawQuery = params.q;
  if (Array.isArray(rawQuery) || (rawQuery?.length ?? 0) > 100) notFound();
  const search = (rawQuery ?? "").trim();
  const parsed = parsePhotoTags(typeof rawTag === "string" ? rawTag : "");
  if (Array.isArray(rawTag) || parsed.error || parsed.tags.length > 1) notFound();
  const tag = parsed.tags[0];
  const [membership, result] = await Promise.all([
    getActiveMembership(),
    getPhotoList(tag, search).then((posts) => ({ posts, error: false })).catch(() => ({ posts: [], error: true })),
  ]);
  const canManage = membership && PHOTO_MANAGER_ROLES.some((role) => role === membership.role);
  return (
    <div className="space-y-8">
      <PageHeader title="과 활동" description="정보시스템의 활동을 만나보세요."
        actions={canManage ? <LinkButton href="/photos/new">사진 올리기</LinkButton> : undefined} />
      <form key={`${tag ?? ""}:${search}`} action="/photos" method="get" role="search" aria-label="과 활동 검색"
        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-2xl border border-border-input/50 bg-surface p-3 sm:gap-3 sm:p-5">
        {tag && <input type="hidden" name="tag" value={tag} />}
        <div className="min-w-0 flex-1">
          <TextField name="q" type="search" label="과 활동 검색" defaultValue={search} maxLength={100}
            placeholder="제목, 설명, 해시태그로 검색" />
        </div>
        <div className="flex justify-center gap-2">
          <Button type="submit" aria-label="검색" title="검색" className="h-11 w-11 shrink-0 px-0!">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" />
            </svg>
          </Button>
          {search && <SecondaryLinkButton href={tag ? photoTagHref(tag) : "/photos"}
            aria-label="검색 초기화" title="검색 초기화" className="h-11 w-11 shrink-0 px-0!">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.93 9h-2.02a6 6 0 1 1-1.85-5.23L13 11h7V4l-2.35 2.35Z" />
            </svg>
          </SecondaryLinkButton>}
        </div>
      </form>
      {tag && <div className="flex flex-wrap items-center gap-3">
        <p className="break-all text-base font-semibold">#{tag} 과 활동</p>
        <PillLink href="/photos" current={false}>전체 보기</PillLink>
      </div>}
      {result.error ? <Alert>과 활동을 불러오지 못했습니다. 새로고침해 주세요.</Alert> :
        <PhotoListPages posts={result.posts} requestedPage={requestedPage} tag={tag} search={search} />}
    </div>
  );
}
