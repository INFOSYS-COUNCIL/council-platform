"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/result";
import { initialActionState } from "@/lib/actions/result";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { TextField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";

export type OrgItem = { id: string; name: string; sort_order: number; is_active: boolean };
type Action = (previous: ActionState, data: FormData) => Promise<ActionState>;

export function OrgSettings({ label, items, create, update, setActive }: {
  label: string;
  items: OrgItem[];
  create: Action;
  update: Action;
  setActive: Action;
}) {
  const [createState, createAction] = useActionState(create, initialActionState);
  const sorted = [...items].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return <div className="space-y-6">
    <form action={createAction} className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="font-semibold">{label} 추가</h2>
      <TextField label="이름" name="name" required maxLength={100} error={createState.status === "error" ? createState.fieldErrors?.name : undefined} />
      <TextField label="순서" name="sortOrder" type="number" defaultValue={items.length} required />
      <SubmitButton>추가</SubmitButton>
      <FormMessage state={createState} />
    </form>
    {sorted.length === 0 ? <EmptyState title={`등록된 ${label}이 없습니다`} description={`${label}을 추가해 주세요.`} /> :
      <ul className="space-y-4">{sorted.map(item => <OrgRow key={item.id} label={label} item={item} update={update} setActive={setActive} />)}</ul>}
  </div>;
}

function OrgRow({ label, item, update, setActive }: { label: string; item: OrgItem; update: Action; setActive: Action }) {
  const [updateState, updateAction] = useActionState(update, initialActionState);
  const [activeState, activeAction] = useActionState(setActive, initialActionState);
  return <li className={`space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700 ${item.is_active ? "" : "opacity-65"}`}>
    <p className="font-medium">{item.name} <span className="text-sm font-normal">({item.is_active ? "사용 중" : "비활성"})</span></p>
    <form action={updateAction} className="space-y-3">
      <input type="hidden" name="id" value={item.id} />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
        <TextField id={`name-${item.id}`} label={`${label} 이름`} name="name" defaultValue={item.name} required maxLength={100} error={updateState.status === "error" ? updateState.fieldErrors?.name : undefined} />
        <TextField id={`order-${item.id}`} label="순서" name="sortOrder" type="number" defaultValue={item.sort_order} required />
        <SubmitButton variant="secondary">변경 저장</SubmitButton>
      </div>
      <FormMessage state={updateState} />
    </form>
    <form action={activeAction} className="space-y-2">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="active" value={item.is_active ? "false" : "true"} />
      <SubmitButton variant="secondary">{item.is_active ? "비활성화" : "다시 사용"}</SubmitButton>
      <FormMessage state={activeState} />
    </form>
  </li>;
}
