"use client";

import { useActionState, useId, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { TextField, TextareaField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { initialActionState } from "@/lib/actions/result";
import type { Json } from "@/lib/supabase/database.types";
import { photoImageUrls } from "@/lib/photos/content";
import { savePhotoPost } from "./actions";
import { PhotoEditor } from "./photo-editor";

export function PhotoForm({ postId, userId, initial }: {
  postId: string;
  userId: string;
  initial?: { title: string; description: string; body: Json; revision: number; coverUrl?: string | null };
}) {
  const formId = useId();
  const [state, formAction, pending] = useActionState(savePhotoPost, initialActionState);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [body, setBody] = useState(JSON.stringify(initial?.body ?? []));
  const [selectedCover, setSelectedCover] = useState(initial?.coverUrl ?? "");
  const images = [...new Set(photoImageUrls(JSON.parse(body)))];
  // 선택한 사진을 지우면 남은 첫 사진을 기본 썸네일로 사용한다.
  const coverUrl = images.includes(selectedCover) ? selectedCover : images[0] ?? "";
  const [uploading, setUploading] = useState(false);
  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <div className="max-w-4xl space-y-5">
      <form id={formId} action={formAction} className="space-y-5">
        <input type="hidden" name="postId" value={postId} />
        <input type="hidden" name="revision" value={initial?.revision ?? 0} />
        <input type="hidden" name="body" value={body} />
        <input type="hidden" name="coverUrl" value={coverUrl} />
        <fieldset disabled={pending} className="min-w-0 space-y-5">
          <TextField name="title" label="제목" value={title} maxLength={120} required
            onChange={(event) => setTitle(event.target.value)} error={errors?.title} />
          <TextareaField name="description" label="간단한 설명" value={description} maxLength={1000}
            rows={3} onChange={(event) => setDescription(event.target.value)} error={errors?.description} />
        </fieldset>
      </form>
      <PhotoEditor postId={postId} userId={userId} initialBody={initial?.body ?? []}
        readOnly={pending} onChange={setBody} onUploading={setUploading} />
      {images.length > 0 && (
        <fieldset disabled={pending || uploading} className="space-y-3">
          <legend className="text-sm font-medium">목록 썸네일 선택</legend>
          <p className="text-sm text-muted">목록에는 선택한 사진이 정사각형으로 표시됩니다. 상세 사진 순서는 바뀌지 않습니다.</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {images.map((url, index) => (
              <label key={url} className="relative cursor-pointer">
                <input type="radio" name="thumbnail-choice" value={url}
                  aria-label={`${index + 1}번 사진을 썸네일로 선택`}
                  checked={coverUrl === url} onChange={() => setSelectedCover(url)}
                  className="peer sr-only" />
                <span className="relative block aspect-square overflow-hidden rounded-xl border-2 border-transparent peer-checked:border-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-accent">
                  <Image src={url} alt={`${index + 1}번 사진 썸네일 미리보기`} fill unoptimized
                    sizes="(min-width: 640px) 180px, 33vw" className="object-cover" />
                </span>
                {coverUrl === url && <span className="absolute right-1 bottom-1 rounded bg-surface px-2 py-1 text-xs font-semibold text-foreground">선택됨</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <FormMessage state={state} />
      <Button type="submit" form={formId} disabled={pending || uploading} aria-busy={pending || uploading}>
        {uploading ? "사진을 올리는 중…" : pending ? "저장 중…" : initial ? "수정 저장" : "게시하기"}
      </Button>
    </div>
  );
}
