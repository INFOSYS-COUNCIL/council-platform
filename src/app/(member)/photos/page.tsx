import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getActiveMembership, requireUser } from "@/lib/auth/session";
import { PHOTO_MANAGER_ROLES } from "@/lib/photos/content";
import { getPhotoList } from "@/lib/photos/queries";
import { PhotoGrid } from "./photo-grid";
import PhotosLoading from "./loading";

export const metadata: Metadata = { title: "활동 사진" };

export default function PhotosPage() {
  return <Suspense fallback={<PhotosLoading />}><PhotosContent /></Suspense>;
}

async function PhotosContent() {
  await requireUser("/photos");
  const [membership, result] = await Promise.all([
    getActiveMembership(),
    getPhotoList().then((posts) => ({ posts, error: false })).catch(() => ({ posts: [], error: true })),
  ]);
  const canManage = membership && PHOTO_MANAGER_ROLES.some((role) => role === membership.role);
  return (
    <div className="space-y-8">
      <PageHeader title="활동 사진" description="사진으로 남기는 우리 학과의 이야기."
        actions={canManage ? <LinkButton href="/photos/new">사진 올리기</LinkButton> : undefined} />
      {result.error ? <Alert>활동 사진을 불러오지 못했습니다. 새로고침해 주세요.</Alert> : <PhotoGrid posts={result.posts} />}
    </div>
  );
}
