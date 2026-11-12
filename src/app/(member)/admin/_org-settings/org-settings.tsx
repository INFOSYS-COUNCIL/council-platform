"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/actions/result";
import { initialActionState } from "@/lib/actions/result";
import { EmptyState } from "@/components/ui/empty-state";
import { FormMessage } from "@/components/ui/form-message";
import { ManageMenu } from "@/components/ui/manage-menu";
import { TextField } from "@/components/ui/form-field";
import { SubmitButton } from "@/components/ui/submit-button";

export type OrgItem = { id: string; name: string; sort_order: number; is_active: boolean };
type Action = (previous: ActionState, data: FormData) => Promise<ActionState>;

export function OrgSettings({ label, items, create, update, setActive, remove }: {
  label: string;
  items: OrgItem[];
  create: Action;
  update: Action;
  setActive: Action;
  remove: Action;
}) {
  const [createState, createAction] = useActionState(create, initialActionState);
  const sorted = [...items].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return <div className="space-y-6">
    <form action={createAction} className="space-y-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
      <h2 className="font-semibold">새 {label} 추가</h2>
      <TextField label="이름" name="name" required maxLength={100} error={createState.status === "error" ? createState.fieldErrors?.name : undefined} />
      <TextField label="순서" name="sortOrder" type="number" defaultValue={items.length} required />
      <SubmitButton>추가</SubmitButton>
      <FormMessage state={createState} />
    </form>
    {sorted.length === 0 ? <EmptyState title={`등록된 ${label} 항목이 없습니다`} description="위 양식에서 추가해 주세요." /> :
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-surface dark:divide-zinc-800 dark:border-zinc-800">{sorted.map(item => <OrgRow key={item.id} label={label} item={item} update={update} setActive={setActive} remove={remove} />)}</ul>}
  </div>;
}

function OrgRow({ label, item, update, setActive, remove }: { label: string; item: OrgItem; update: Action; setActive: Action; remove: Action }) {
  const [updateState, updateAction] = useActionState(update, initialActionState);
  const [activeState, activeAction] = useActionState(setActive, initialActionState);
  const [removeState, removeAction] = useActionState(remove, initialActionState);
  return <li className={`flex items-center justify-between gap-3 px-4 py-3 ${item.is_active ? "" : "opacity-65"}`}>
    <p className="min-w-0 font-medium">
      {item.name}{" "}
      <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">· 순서 {item.sort_order}{item.is_active ? "" : " · 사용 중지"}</span>
    </p>
    <ManageMenu
      title={`${label} 관리`}
      subtitle={item.name}
      items={[
        {
          key: "edit",
          label: "수정",
          content: <form action={updateAction} className="space-y-3">
            <input type="hidden" name="id" value={item.id} />
            <TextField id={`name-${item.id}`} label={`${label} 이름`} name="name" defaultValue={item.name} required maxLength={100} error={updateState.status === "error" ? updateState.fieldErrors?.name : undefined} />
            <TextField id={`order-${item.id}`} label="순서" name="sortOrder" type="number" defaultValue={item.sort_order} required hint="작은 숫자가 앞에 옵니다." />
            <SubmitButton>수정 저장</SubmitButton>
            <FormMessage state={updateState} />
          </form>,
        },
        {
          key: "active",
          label: item.is_active ? "사용 중지" : "다시 사용",
          content: <form action={activeAction} className="space-y-3">
            <p className="text-sm">{item.is_active
              ? `이 ${label}을(를) 더 이상 고를 수 없게 합니다. 지금 소속된 사람이 있으면 중지되지 않습니다. 기록은 남습니다.`
              : `이 ${label}을(를) 다시 고를 수 있게 합니다.`}</p>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="active" value={item.is_active ? "false" : "true"} />
            <SubmitButton>{item.is_active ? "사용 중지" : "다시 사용"}</SubmitButton>
            <FormMessage state={activeState} />
          </form>,
        },
        {
          key: "delete",
          label: "삭제",
          danger: true,
          content: <form action={removeAction} className="space-y-3">
            <p className="text-sm">{`이 ${label}을(를) 완전히 지웁니다. 되돌릴 수 없습니다. 이 ${label}을(를) 쓰는 구성원이나 기록이 있으면 지워지지 않으니, 그때는 사용 중지해 주세요.`}</p>
            <input type="hidden" name="id" value={item.id} />
            <SubmitButton>삭제</SubmitButton>
            <FormMessage state={removeState} />
          </form>,
        },
      ]}
    />
  </li>;
}
