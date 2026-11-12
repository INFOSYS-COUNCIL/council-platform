"use client";

import { useState } from "react";
import type { SelectOption } from "@/components/ui/form-field";
import { MEETING_SCOPE_LABELS, MEETING_SCOPES, type MeetingScope } from "@/lib/meetings/labels";

const CHOICE =
  "flex gap-3 rounded-md border border-zinc-300 p-3 has-checked:border-coral-700 dark:border-zinc-700 dark:has-checked:border-coral-400";

// 회의록 만들기·수정이 함께 쓰는 열람 범위 칸. 이름: scope, department_ids
export function MeetingScopeFields({
  departments,
  defaultScope = "ALL_COUNCIL",
  defaultDepartmentIds = [],
  error,
}: {
  departments: SelectOption[];
  defaultScope?: MeetingScope;
  defaultDepartmentIds?: string[];
  error?: string;
}) {
  const [scope, setScope] = useState<MeetingScope>(defaultScope);
  return (
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
              <input
                type="checkbox"
                name="department_ids"
                value={d.value}
                defaultChecked={defaultDepartmentIds.includes(d.value)}
                className="accent-coral-700"
              />
              {d.label}
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      <p id="scope-hint" className="rounded-md bg-coral-50 p-3 text-sm text-coral-950 dark:bg-zinc-900 dark:text-coral-200">
        범위와 상관없이 <strong>회장단, 만든 사람, 대표 작성자와 편집자</strong>는 항상 볼 수 있습니다.
      </p>
    </fieldset>
  );
}
