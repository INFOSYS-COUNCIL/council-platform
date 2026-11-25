import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/detail";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { PHOTO_MANAGER_ROLES } from "@/lib/photos/content";
import { PhotoForm } from "../photo-form";

export const metadata: Metadata = { title: "과 활동 올리기" };

export default function NewPhotoPage() {
  return <Suspense fallback={<Skeleton />}><NewPhotoContent /></Suspense>;
}

async function NewPhotoContent() {
  await requireMember("/photos/new", PHOTO_MANAGER_ROLES);
  const userId = (await getCurrentUserId())!;
  const postId = crypto.randomUUID();
  return (
    <div className="space-y-6">
      <SecondaryLinkButton href="/photos">과 활동 목록으로</SecondaryLinkButton>
      <PageHeader title="과 활동 올리기" description="함께한 순간과 짧은 이야기를 남겨주세요." />
      <PhotoForm key={postId} postId={postId} userId={userId} />
    </div>
  );
}
