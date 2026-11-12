"use client";

import { useState } from "react";
import { TextField, type SelectOption } from "@/components/ui/form-field";
import { PAGE_SCOPE_LABELS, PAGE_SCOPES, type PageScope } from "@/lib/pages/labels";

const CHOICE =
  "flex gap-3 rounded-md border border-zinc-300 p-3 has-checked:border-coral-700 dark:border-zinc-700 dark:has-checked:border-coral-400";

// 페이지 만들기·수정이 함께 쓰는 칸: 제목, 태그, 공개 범위(전체 / 담당국 / 지정)
export function PageFields({
  departments,
  members,
  initial,
  errors = {},
}: {
  departments: SelectOption[];
  members: SelectOption[];
  initial?: { title: string; tags: string[]; scope: PageScope; departmentIds: string[]; userIds: string[] };
  errors?: Partial<Record<string, string>>;
}) {
  const [scope, setScope] = useState<PageScope>(initial?.scope ?? "ALL_COUNCIL");
  const box = "grid max-h-56 gap-2 overflow-y-auto rounded-md border border-zinc-200 p-3 sm:grid-cols-2 dark:border-zinc-800";
  return (
    <div className="space-y-5">
      <TextField label="제목" name="title" required maxLength={100} defaultValue={initial?.title} error={errors.title} />
      <TextField
        label="태그"
        name="tags"
        maxLength={250}
        defaultValue={initial?.tags.join(", ")}
        hint="쉼표로 나눠 적습니다. 예: 예산, 행사 준비 (10개까지)"
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">공개 범위</legend>
        {PAGE_SCOPES.map((s) => (
          <label key={s} className={CHOICE}>
            <input type="radio" name="scope" value={s} checked={scope === s} onChange={() => setScope(s)} className="mt-1 accent-coral-700" />
            <span>
              <span className="block font-medium">{PAGE_SCOPE_LABELS[s].label}</span>
              <span className="block text-sm text-zinc-600 dark:text-zinc-400">{PAGE_SCOPE_LABELS[s].description}</span>
            </span>
          </label>
        ))}
        {scope === "DEPARTMENTS" && (
          <div className={box}>
            {departments.map((d) => (
              <label key={d.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="department_ids" value={d.value} defaultChecked={initial?.departmentIds.includes(d.value)} className="accent-coral-700" />
                {d.label}
              </label>
            ))}
          </div>
        )}
        {scope === "USERS" && (
          <div className={box}>
            {members.map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="user_ids" value={m.value} defaultChecked={initial?.userIds.includes(m.value)} className="accent-coral-700" />
                {m.label}
              </label>
            ))}
          </div>
        )}
        {errors.scope && <p className="text-sm text-red-700 dark:text-red-400">{errors.scope}</p>}
        <p className="text-sm text-zinc-600 dark:text-zinc-400">범위와 상관없이 회장단과 만든 사람은 항상 볼 수 있습니다.</p>
      </fieldset>
    </div>
  );
}
