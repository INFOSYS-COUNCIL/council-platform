import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { ManageMenu } from "@/components/ui/manage-menu";
import { getActiveMembership, requireUser } from "@/lib/auth/session";
import { PHOTO_MANAGER_ROLES, UUID_PATTERN } from "@/lib/photos/content";
import { getPhotoPost } from "@/lib/photos/queries";
import { deletePhotoPost } from "../actions";
import { PhotoDetail } from "../photo-detail";
import { PhotoEditor } from "../photo-editor";

export const metadata: Metadata = { title: "과 활동" };

export default function PhotoPage(props: PageProps<"/photos/[photoId]">) {
  return <Suspense fallback={<Skeleton />}><PhotoContent params={props.params} /></Suspense>;
}

async function PhotoContent({ params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;
  await requireUser(`/photos/${photoId}`);
  if (!UUID_PATTERN.test(photoId)) notFound();
  const [membership, result] = await Promise.all([
    getActiveMembership(),
    getPhotoPost(photoId).then((post) => ({ post, error: false })).catch(() => ({ post: null, error: true })),
  ]);
  if (result.error) return <Alert>사진을 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const post = result.post;
  if (!post) notFound();
  const canManage = membership && PHOTO_MANAGER_ROLES.some((role) => role === membership.role);
  return (
    <PhotoDetail title={post.title} description={post.description} tags={post.tags}
      actions={canManage ? (
        <div className="flex items-center gap-2">
        <SecondaryLinkButton href={`/photos/${post.id}/edit`}>수정</SecondaryLinkButton>
        <ManageMenu title="과 활동 관리" items={[
          { key: "delete", label: "삭제", danger: true, content: (
            <ActionForm action={deletePhotoPost} submitLabel="삭제하기">
              <input type="hidden" name="postId" value={post.id} />
              <p className="text-sm">이 글을 목록에서 삭제하고 사진 열람을 차단합니다. 삭제할까요?</p>
            </ActionForm>
          ) },
        ]} />
        </div>
      ) : undefined}
    >
      <PhotoEditor key={`${post.id}:${post.revision}`} postId={post.id} userId="" initialBody={post.body} readOnly />
    </PhotoDetail>
  );
}
