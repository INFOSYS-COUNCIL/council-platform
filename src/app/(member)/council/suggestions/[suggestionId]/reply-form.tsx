"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { TextareaField } from "@/components/ui/form-field";
import { addSuggestionMessage } from "../../../suggestions/actions";

export function ReplyForm({ suggestionId, isPublic }: { suggestionId: string; isPublic: boolean; }) {
  const [mode, setMode] = useState<"AUTHOR_VISIBLE" | "INTERNAL">("AUTHOR_VISIBLE");
  return (
    <div className="space-y-3 rounded-xl border border-border-input bg-surface p-4">
      <div role="group" aria-label="답변 공개 범위" className="flex gap-2">
        <Button variant="secondary" aria-pressed={mode === "AUTHOR_VISIBLE"} onClick={() => setMode("AUTHOR_VISIBLE")} className={mode === "AUTHOR_VISIBLE" ? "bg-foreground! text-background" : ""}>공개 답변</Button>
        <Button variant="secondary" aria-pressed={mode === "INTERNAL"} onClick={() => setMode("INTERNAL")} className={mode === "INTERNAL" ? "bg-foreground! text-background" : ""}>내부 메모</Button>
      </div>
      <ActionForm action={addSuggestionMessage} submitLabel={mode === "AUTHOR_VISIBLE" ? "답변 보내기 (승인 대기)" : "메모 저장"}>
        <input type="hidden" name="suggestion_id" value={suggestionId} />
        <input type="hidden" name="message_type" value={mode} />
        <TextareaField
          label={mode === "AUTHOR_VISIBLE" ? "작성자에게 보낼 답변" : "내부 메모"}
          name="body"
          rows={4}
          maxLength={3000}
          required
          hint={mode === "INTERNAL" ? "처리자와 회장단만 봅니다." : `회장단·국장이 승인하면 ${isPublic ? "작성자와 ‘모두의 건의’" : "작성자"}에게 보입니다.`}
        />
      </ActionForm>
    </div>
  );
}
