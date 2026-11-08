"use client";

import { useActionState } from "react";
import {
  SelectField,
  TextareaField,
  TextField,
  type SelectOption,
} from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_ORDER,
  VISIBILITY_LABELS,
} from "@/lib/tasks/labels";
import { createTask } from "../actions";

const PRIORITY_OPTIONS = TASK_PRIORITY_ORDER.map((p) => ({ value: p, label: TASK_PRIORITY_LABELS[p] }));

export function NewTaskForm({
  departments,
  members,
  defaultDepartmentId,
}: {
  departments: SelectOption[];
  members: SelectOption[];
  defaultDepartmentId: string;
}) {
  const [state, formAction] = useActionState(createTask, initialActionState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  // 실패하면 입력한 값을 그대로 두도록 defaultValue는 처음 한 번만 쓰인다
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <TextField label="제목" name="title" required maxLength={100} error={errors.title} />
      <TextareaField
        label="설명"
        name="description"
        rows={5}
        maxLength={10000}
        hint="참고 링크는 설명에 적어 주세요. 파일은 행사 자료로 올립니다."
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="담당 국"
          name="department_id"
          required
          options={departments}
          placeholder="선택하세요"
          defaultValue={defaultDepartmentId}
          error={errors.department_id}
        />
        <SelectField
          label="담당자"
          name="assignee_id"
          options={members}
          placeholder="아직 정하지 않음"
          error={errors.assignee_id}
        />
        <SelectField
          label="우선순위"
          name="priority"
          required
          options={PRIORITY_OPTIONS}
          defaultValue="NORMAL"
          error={errors.priority}
        />
        <div aria-hidden="true" className="hidden sm:block" />
        <TextField label="시작일" name="start_date" type="date" error={errors.start_date} />
        <TextField label="마감일" name="due_date" type="date" error={errors.due_date} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">공개 모드</legend>
        {(["DEFAULT", "RESTRICTED"] as const).map((mode) => (
          <label key={mode} className="flex gap-3 rounded-md border border-zinc-300 p-3 has-checked:border-coral-700 dark:border-zinc-700 dark:has-checked:border-coral-400">
            <input type="radio" name="visibility_mode" value={mode} defaultChecked={mode === "DEFAULT"} className="mt-1 accent-coral-700" />
            <span>
              <span className="block font-medium">{VISIBILITY_LABELS[mode].label}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                {VISIBILITY_LABELS[mode].description}
              </span>
            </span>
          </label>
        ))}
        {errors.visibility_mode && (
          <p className="text-sm text-red-700 dark:text-red-400">{errors.visibility_mode}</p>
        )}
      </fieldset>

      <SubmitButton pendingLabel="만드는 중…">업무 만들기</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
