"use client";

import { useActionState } from "react";
import { SelectField, TextField, type SelectOption } from "@/components/ui/form-field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { createMeeting } from "../actions";
import { MeetingScopeFields } from "../scope-fields";

export function NewMeetingForm({
  me,
  defaultMeetingAt,
  members,
  departments,
  templates,
}: {
  me: string;
  defaultMeetingAt: string;
  members: SelectOption[];
  departments: SelectOption[];
  templates: SelectOption[];
}) {
  const [state, formAction] = useActionState(createMeeting, initialActionState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <TextField label="제목" name="title" required maxLength={100} error={errors.title} />
      <div className="grid gap-5 sm:grid-cols-2">
        <DateTimePicker label="회의 일시" name="meeting_at" required defaultValue={defaultMeetingAt} hint="한국 시간" error={errors.meeting_at} />
        <SelectField label="템플릿" name="template_id" options={templates} placeholder="빈 문서로 시작" error={errors.template_id} />
      </div>

      <MeetingScopeFields departments={departments} error={errors.scope} />

      <SelectField label="대표 작성자" name="author_id" required options={members} defaultValue={me} hint="대표 작성자는 자동으로 편집자가 됩니다." error={errors.author_id} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">편집자</legend>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">본문을 함께 고칠 사람입니다. 회장단은 지정하지 않아도 고칠 수 있습니다.</p>
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-md border border-zinc-200 p-3 sm:grid-cols-2 dark:border-zinc-800">
          {members.map((m) => (
            <label key={m.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="editor_ids" value={m.value} defaultChecked={m.value === me} className="accent-coral-700" />
              {m.label}
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="만드는 중…">회의록 만들기</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
