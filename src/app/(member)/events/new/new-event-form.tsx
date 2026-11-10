"use client";

import { useActionState } from "react";
import { SelectField, TextareaField, TextField, type SelectOption } from "@/components/ui/form-field";
import { DateTimeRange } from "@/components/ui/date-time-picker";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { EVENT_VISIBILITY_LABELS } from "@/lib/events/labels";
import { createEvent } from "../actions";

export function NewEventForm({
  departments,
  defaultDepartmentId,
}: {
  departments: SelectOption[];
  defaultDepartmentId: string;
}) {
  const [state, formAction] = useActionState(createEvent, initialActionState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <TextField label="행사 이름" name="name" required maxLength={100} error={errors.name} />
      <TextareaField label="설명" name="description" rows={5} maxLength={10000} />
      <SelectField
        label="담당 국"
        name="owner_department_id"
        required
        options={departments}
        placeholder="선택하세요"
        defaultValue={defaultDepartmentId}
        error={errors.owner_department_id}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <DateTimeRange startName="starts_at" endName="ends_at" hint="선택 사항 · 한국 시간" />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">공개 범위</legend>
        {(["ALL_COUNCIL", "RESTRICTED"] as const).map((mode) => (
          <label
            key={mode}
            className="flex gap-3 rounded-md border border-zinc-300 p-3 has-checked:border-coral-700 dark:border-zinc-700 dark:has-checked:border-coral-400"
          >
            <input type="radio" name="visibility_mode" value={mode} defaultChecked={mode === "ALL_COUNCIL"} className="mt-1 accent-coral-700" />
            <span>
              <span className="block font-medium">{EVENT_VISIBILITY_LABELS[mode].label}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                {EVENT_VISIBILITY_LABELS[mode].description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <SubmitButton pendingLabel="만드는 중…">행사 만들기</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
