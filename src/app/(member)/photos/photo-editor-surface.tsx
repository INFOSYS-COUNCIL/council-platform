"use client";

import "@blocknote/mantine/style.css";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { useColorScheme } from "@/components/ui/theme-picker";
import { MEETING_DICTIONARY, MARKDOWN_PASTE, MeetingSlashMenu } from "@/lib/meetings/editor-parts";
import { meetingSchema, type MeetingBlock } from "@/lib/meetings/schema";
import {
  PHOTO_BUCKET, PHOTO_MAX_COUNT, photoImageUrl, photoImageUrls, validatePhotoFile,
} from "@/lib/photos/content";
import { createClient } from "@/lib/supabase/client";
import type { Json } from "@/lib/supabase/database.types";

export function PhotoEditorSurface({
  postId, userId, initialBody, readOnly = false, onChange, onUploading,
}: {
  postId: string;
  userId: string;
  initialBody: Json;
  readOnly?: boolean;
  onChange?: (body: string) => void;
  onUploading?: (busy: boolean) => void;
}) {
  const theme = useColorScheme();
  const bodyRef = useRef(initialBody);
  const pendingUploads = useRef(0);
  const [notice, setNotice] = useState("");
  const [adding, setAdding] = useState(false);
  const editor = useCreateBlockNote({
    schema: meetingSchema,
    dictionary: MEETING_DICTIONARY,
    // 저장된 JSON은 이 편집기의 스키마로 작성한다.
    initialContent: Array.isArray(initialBody) && initialBody.length ? initialBody as MeetingBlock[] : undefined,
    uploadFile: async (file) => {
      const invalid = validatePhotoFile(file);
      if (invalid) throw new Error(invalid);
      if (photoImageUrls(bodyRef.current).length + pendingUploads.current >= PHOTO_MAX_COUNT) {
        throw new Error("게시물마다 사진은 20장까지 넣을 수 있습니다.");
      }
      pendingUploads.current += 1;
      onUploading?.(true);
      try {
        const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
        const path = `${postId}/${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await createClient().storage.from(PHOTO_BUCKET).upload(path, file, { contentType: file.type });
        if (error) throw new Error("사진을 올리지 못했습니다. 다시 시도해 주세요.");
        return photoImageUrl(path);
      } finally {
        pendingUploads.current -= 1;
        onUploading?.(pendingUploads.current > 0);
      }
    },
    pasteHandler: ({ event, defaultPasteHandler }) => {
      if ([...(event.clipboardData?.files ?? [])].some((file) => validatePhotoFile(file))) {
        setNotice("PNG·JPG·WEBP 사진(한 장 5MB 이하)만 붙여넣을 수 있습니다.");
        return true;
      }
      return defaultPasteHandler(MARKDOWN_PASTE);
    },
  }, []);

  async function addFiles(files: File[]) {
    setAdding(true);
    onUploading?.(true);
    setNotice("");
    try {
      if (files.length + photoImageUrls(bodyRef.current).length > PHOTO_MAX_COUNT) {
        throw new Error("게시물마다 사진은 20장까지 넣을 수 있습니다.");
      }
      for (const file of files) {
        const url = await editor.uploadFile!(file);
        if (typeof url !== "string") throw new Error("사진 주소를 확인해 주세요.");
        editor.insertBlocks([{ type: "image", props: { url } }], editor.document[editor.document.length - 1], "after");
        bodyRef.current = JSON.parse(JSON.stringify(editor.document));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "사진을 올리지 못했습니다.");
    } finally {
      setAdding(false);
      onUploading?.(pendingUploads.current > 0);
    }
  }

  return (
    <div className="min-w-0 space-y-3">
      {!readOnly && (
        <div className="space-y-2">
          <label className="block text-sm font-medium" htmlFor="activity-photo-files">사진 여러 장 추가</label>
          <input id="activity-photo-files" type="file" accept="image/png,image/jpeg,image/webp" multiple
            disabled={adding}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void addFiles(files);
            }}
            className="max-w-full rounded-lg border border-border-input bg-surface p-2 text-sm focus-visible:outline-2 focus-visible:outline-accent" />
          <p className="text-xs text-muted">PNG·JPG·WEBP, 한 장 5MB 이하, 최대 20장. 아래에서 목록에 표시할 썸네일을 고를 수 있습니다.</p>
          {adding && <p role="status" className="text-sm">사진을 올리는 중…</p>}
        </div>
      )}
      {notice && <Alert>{notice}</Alert>}
      <div className={readOnly ? "bg-surface py-4 [&_.bn-visual-media-wrapper]:w-full" : "min-h-48 rounded-xl border border-border-input bg-surface py-4"}>
        <BlockNoteView editor={editor} theme={theme} editable={!readOnly && !adding} slashMenu={false}
          onChange={() => {
            const serialized = JSON.stringify(editor.document);
            bodyRef.current = JSON.parse(serialized);
            onChange?.(serialized);
          }}>
          {!readOnly && <MeetingSlashMenu editor={editor} />}
        </BlockNoteView>
      </div>
    </div>
  );
}
