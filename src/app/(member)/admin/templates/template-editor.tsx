"use client";

import "@blocknote/mantine/style.css";
import type { PartialBlock } from "@blocknote/core";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import { blocksFilePaste, MEETING_DICTIONARY, MeetingSlashMenu } from "@/lib/meetings/editor-parts";
import { meetingSchema } from "@/lib/meetings/schema";
import type { Json } from "@/lib/supabase/database.types";

// Template 초기 Block 편집기. 공동편집 없이 Block 배열(JSON)만 만든다(기획서 6.7절)
export function TemplateEditor({ initialBlocks, onChange }: { initialBlocks: Json; onChange: (json: string) => void }) {
  const editor = useCreateBlockNote({
    schema: meetingSchema,
    dictionary: MEETING_DICTIONARY,
    initialContent:
      Array.isArray(initialBlocks) && initialBlocks.length > 0 ? (initialBlocks as PartialBlock[]) : undefined,
    pasteHandler: ({ event, defaultPasteHandler }) => blocksFilePaste(event) || defaultPasteHandler(),
  });

  return (
    <div
      aria-labelledby="template-body-label"
      className="min-h-48 rounded-md border border-zinc-300 bg-white py-4 dark:border-zinc-700 dark:bg-zinc-900"
    >
      <BlockNoteView editor={editor} slashMenu={false} onChange={() => onChange(JSON.stringify(editor.document))}>
        <MeetingSlashMenu editor={editor} />
      </BlockNoteView>
    </div>
  );
}
