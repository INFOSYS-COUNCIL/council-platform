import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { PHOTO_MANAGER_ROLES, UUID_PATTERN } from "@/lib/photos/content";
import { getPhotoPost } from "@/lib/photos/queries";
import { PhotoForm } from "../../photo-form";

export const metadata: Metadata = { title: "과 활동 수정" };

export default function EditPhotoPage(props: PageProps<"/photos/[photoId]/edit">) {
  return <Suspense fallback={<Skeleton />}><EditContent params={props.params} /></Suspense>;
}

async function EditContent({ params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  await requireMember(`/photos/${photoId}/edit`, PHOTO_MANAGER_ROLES);
  if (!UUID_PATTERN.test(photoId)) notFound();
  const userId = (await getCurrentUserId())!;
  let post;
  try {
    post = await getPhotoPost(photoId);
  } catch {
    return <Alert>과 활동을 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }
  if (!post) notFound();
  return (
    <div className="space-y-6">
      <SecondaryLinkButton href={`/photos/${post.id}`}>상세 화면으로</SecondaryLinkButton>
      <PageHeader title="과 활동 수정" />
      <PhotoForm key={`${post.id}:${post.revision}`} postId={post.id} userId={userId} initial={post} />
    </div>
  );
}
