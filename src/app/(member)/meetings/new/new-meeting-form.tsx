"use client";

import { useActionState, useState } from "react";
import { SelectField, TextField, type SelectOption } from "@/components/ui/form-field";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { MEETING_SCOPE_LABELS, MEETING_SCOPES, type MeetingScope } from "@/lib/meetings/labels";
import { createMeeting } from "../actions";

const CHOICE =
  "flex gap-3 rounded-md border border-zinc-300 p-3 has-checked:border-coral-700 dark:border-zinc-700 dark:has-checked:border-coral-400";

export function NewMeetingForm({
  me,
  defaultMeetingAt,
  members,
  departments,
  templates,
  events,
  defaultEventId,
}: {
  me: string;
  defaultMeetingAt: string;
  members: SelectOption[];
  departments: SelectOption[];
  templates: SelectOption[];
  events: SelectOption[];
  defaultEventId: string;
}) {
  const [state, formAction] = useActionState(createMeeting, initialActionState);
  const [scope, setScope] = useState<MeetingScope>("ALL_COUNCIL");
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <TextField label="제목" name="title" required maxLength={100} error={errors.title} />
      <div className="grid gap-5 sm:grid-cols-2">
        <DateTimePicker label="회의 일시" name="meeting_at" required defaultValue={defaultMeetingAt} hint="한국 시간" error={errors.meeting_at} />
        <SelectField label="템플릿" name="template_id" options={templates} placeholder="빈 문서로 시작" error={errors.template_id} />
      </div>
      <SelectField
        label="행사"
        name="event_id"
        options={events}
        placeholder="연결하지 않음"
        defaultValue={defaultEventId}
        hint="행사 회의록은 그 행사를 볼 수 있는 사람만 볼 수 있습니다."
      />

      <fieldset className="space-y-2" aria-describedby="scope-hint">
        <legend className="text-sm font-medium">
          열람 범위 <span className="ml-1 text-red-700 dark:text-red-400">(필수)</span>
        </legend>
        {MEETING_SCOPES.map((s) => (
          <label key={s} className={CHOICE}>
            <input
              type="radio"
              name="scope"
              value={s}
              checked={scope === s}
              onChange={() => setScope(s)}
              className="mt-1 accent-coral-700"
            />
            <span>
              <span className="block font-medium">{MEETING_SCOPE_LABELS[s].label}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">{MEETING_SCOPE_LABELS[s].description}</span>
            </span>
          </label>
        ))}
        {scope === "DEPARTMENTS" && (
          <div className="grid gap-2 pl-2 sm:grid-cols-2">
            {departments.map((d) => (
              <label key={d.value} className="flex items-center gap-2">
                <input type="checkbox" name="department_ids" value={d.value} className="accent-coral-700" />
                {d.label}
              </label>
            ))}
          </div>
        )}
        {errors.scope && <p className="text-sm text-red-700 dark:text-red-400">{errors.scope}</p>}
        <p id="scope-hint" className="rounded-md bg-coral-50 p-3 text-sm text-coral-950 dark:bg-zinc-900 dark:text-coral-200">
          범위와 상관없이 <strong>회장단, 만든 사람(나), 대표 작성자와 편집자</strong>는 항상 볼 수 있습니다.
        </p>
      </fieldset>

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
