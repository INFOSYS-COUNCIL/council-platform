"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, type SelectOption } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { ROLE_LABELS, ROLE_ORDER, type MemberRole } from "@/lib/auth/roles";
import { changeRole, endMembership } from "./actions";

// 표의 "관리" 칸: ⋯ 버튼 → 설정 창. 승인 명단 화면과 같은 방식이다.
// 표가 가로로 스크롤되므로 떠 있는 메뉴 대신 화면 가운데 창(dialog)을 쓴다(Esc로 닫힘).

const roleOptions = ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const MENU_ITEM =
  "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800";

type Mode = "menu" | "role" | "end";

export type MemberRow = {
  id: string;
  name: string;
  role: MemberRole;
  department_id: string | null;
  position_id: string | null;
};

export function MemberActions({
  member,
  departmentName,
  canChangeRole,
  canEnd,
  departments,
  positions,
}: {
  member: MemberRow;
  departmentName: string | null;
  canChangeRole: boolean;
  canEnd: boolean;
  departments: SelectOption[];
  positions: SelectOption[];
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [changed, change] = useActionState(changeRole, initialActionState);
  const [ended, end] = useActionState(endMembership, initialActionState);
  const [role, setRole] = useState<string>(member.role);
  const [departmentId, setDepartmentId] = useState(member.department_id ?? "");
  const [positionId, setPositionId] = useState(member.position_id ?? "");

  const items: { mode: Mode; label: string; danger?: boolean }[] = [
    ...(canChangeRole ? [{ mode: "role" as const, label: "역할·부서·직책 변경" }] : []),
    ...(canEnd ? [{ mode: "end" as const, label: "소속 종료", danger: true }] : []),
  ];
  if (items.length === 0) return null;

  const affiliation = [ROLE_LABELS[member.role], departmentName].filter(Boolean).join(" · ");
  const back = (
    <Button variant="secondary" onClick={() => setMode("menu")}>
      ← 뒤로
    </Button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode("menu");
          dialogRef.current?.showModal();
        }}
        aria-haspopup="dialog"
        aria-label={`${member.name} 설정`}
        title="설정"
        className="grid size-8 place-items-center rounded-md text-lg leading-none text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <span aria-hidden="true">⋯</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-surface p-5 text-foreground shadow-xl backdrop:bg-zinc-950/40 dark:border-zinc-800"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="font-semibold">구성원 설정</h2>
            <p className="break-all text-sm text-zinc-600 dark:text-zinc-400">{member.name} · {affiliation}</p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="닫기"
            className="grid size-8 shrink-0 place-items-center rounded-md hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        {mode === "menu" && (
          <ul className="space-y-1">
            {items.map((item) => (
              <li key={item.mode}>
                <button
                  type="button"
                  onClick={() => setMode(item.mode)}
                  className={`${MENU_ITEM} ${item.danger ? "text-red-700 dark:text-red-400" : ""}`}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        )}

        {mode === "role" && (
          <form action={change} className="space-y-3">
            <input type="hidden" name="membershipId" value={member.id} />
            <SelectField id={`${id}-role`} name="role" label="역할" options={roleOptions}
              value={role} onChange={(event) => setRole(event.target.value)} />
            <SelectField id={`${id}-department`} name="departmentId" label="부서"
              options={departments} placeholder="부서 없음" value={departmentId}
              hint="회장단은 비워도 됩니다. 국장·국원은 부서가 필요합니다."
              onChange={(event) => setDepartmentId(event.target.value)}
              error={changed.status === "error" ? changed.fieldErrors?.departmentId : undefined} />
            <SelectField id={`${id}-position`} name="positionId" label="직책"
              options={positions} placeholder="직책 없음" value={positionId}
              onChange={(event) => setPositionId(event.target.value)} />
            <div className="flex gap-2">{back}<SubmitButton>변경 저장</SubmitButton></div>
            <FormMessage state={changed} />
          </form>
        )}

        {mode === "end" && (
          <form action={end} className="space-y-3">
            <div className="space-y-2 text-sm">
              <p>
                <strong>{member.name}</strong>님을 <strong>{affiliation}</strong> 소속에서 종료할까요?
              </p>
              <p>기록은 남고, 학생회 화면 권한은 즉시 사라집니다.</p>
              <p className="text-zinc-600 dark:text-zinc-400">
                관리 중인 미완료 업무는 그 업무 부서의 국장(없으면 종료하는 사람이나 회장단)에게 자동으로 넘어갑니다.
              </p>
            </div>
            <input type="hidden" name="membershipId" value={member.id} />
            <input type="hidden" name="confirm" value="yes" />
            <div className="flex gap-2">{back}<SubmitButton>소속 종료</SubmitButton></div>
            <FormMessage state={ended} />
          </form>
        )}
      </dialog>
    </>
  );
}
