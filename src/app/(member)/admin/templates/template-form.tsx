"use client";

import dynamic from "next/dynamic";
import { useActionState, useState } from "react";
import { Skeleton } from "@/components/ui/detail";
import { TextField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import type { Json } from "@/lib/supabase/database.types";
import { saveTemplate } from "./actions";

// BlockNote는 브라우저에서만 그린다
const TemplateEditor = dynamic(() => import("./template-editor").then((m) => m.TemplateEditor), {
  ssr: false,
  loading: () => <Skeleton className="h-48" />,
});

export function TemplateForm({ templateId, name, blocks }: { templateId?: string; name: string; blocks: Json }) {
  const [state, formAction] = useActionState(saveTemplate, initialActionState);
  const [json, setJson] = useState(() => JSON.stringify(blocks));

  return (
    <form action={formAction} className="space-y-4">
      {templateId && <input type="hidden" name="template_id" value={templateId} />}
      <input type="hidden" name="blocks" value={json} />
      <TextField label="이름" name="name" required maxLength={50} defaultValue={name} placeholder="전체회의" />
      <div className="space-y-1">
        <p className="text-sm font-medium" id="template-body-label">
          본문
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">&quot;/&quot;를 입력하면 제목·목록·할 일·표 등을 넣을 수 있습니다.</p>
        <TemplateEditor initialBlocks={blocks} onChange={setJson} />
      </div>
      <SubmitButton pendingLabel="저장하는 중…">{templateId ? "저장" : "만들기"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
