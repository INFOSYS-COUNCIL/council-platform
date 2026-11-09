"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { TextareaField, TextField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { IDENTITY_NOTICE } from "@/lib/suggestions/labels";
import { submitSuggestion } from "../actions";

export function NewSuggestionForm({ requestId }: { requestId: string }) {
  const [state, formAction] = useActionState(submitSuggestion, initialActionState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <Alert tone="info">
        {IDENTITY_NOTICE} 제출한 뒤에는 내용을 고칠 수 없고, 접수 상태일 때만 철회할 수 있습니다.
      </Alert>
      <input type="hidden" name="request_id" value={requestId} />
      <TextField label="제목" name="title" required maxLength={100} error={errors.title} />
      <TextareaField
        label="내용"
        name="content"
        required
        rows={8}
        maxLength={3000}
        hint="3000자까지. 첨부 파일은 받지 않습니다."
        error={errors.content}
      />
      <SubmitButton pendingLabel="제출하는 중…">건의 제출</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
