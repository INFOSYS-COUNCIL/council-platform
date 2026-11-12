"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SelectField, TextField, type SelectOption } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/actions/result";
import { ROLE_LABELS, ROLE_ORDER, type MemberRole } from "@/lib/auth/roles";
import { cancelAccount, correctStudentNo, deleteAccount, reactivateMember, updateAccount } from "./actions";

// 표의 "관리" 칸: ⋯ 버튼을 누르면 설정 창(dialog)이 열리고, 할 일을 골라 처리한다.
// 표가 가로로 스크롤되므로 떠 있는 메뉴 대신 화면 가운데 창을 쓴다(잘리지 않고, Esc로 닫힌다).

const roleOptions = ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABELS[role] }));
const MENU_ITEM =
  "block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:hover:bg-zinc-800";

type Mode = "menu" | "update" | "studentNo" | "cancel" | "delete" | "reactivate";

function fieldError(state: ActionState, field: string) {
  return state.status === "error" ? state.fieldErrors?.[field] : undefined;
}

type Account = {
  id: string;
  email: string;
  role: MemberRole;
  department_id: string | null;
  position_id: string | null;
  student_no: string | null;
  is_active: boolean;
};

export function AccountActions({
  account,
  activated,
  ended = false,
  director,
  departments,
  positions,
}: {
  account: Account;
  activated: boolean;
  ended?: boolean;
  director: boolean;
  departments: SelectOption[];
  positions: SelectOption[];
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [updated, update] = useActionState(updateAccount, initialActionState);
  const [cancelled, cancel] = useActionState(cancelAccount, initialActionState);
  const [deleted, remove] = useActionState(deleteAccount, initialActionState);
  const [corrected, correct] = useActionState(correctStudentNo, initialActionState);
  const [reactivated, reactivate] = useActionState(reactivateMember, initialActionState);
  const [studentNo, setStudentNo] = useState(account.student_no ?? "");
  const [role, setRole] = useState<string>(account.role);
  const [departmentId, setDepartmentId] = useState(account.department_id ?? "");
  const [positionId, setPositionId] = useState(account.position_id ?? "");

  const pending = account.is_active && !activated;
  const items: { mode: Mode; label: string; danger?: boolean }[] = [
    ...(ended && account.is_active ? [{ mode: "reactivate" as const, label: "학생회 권한 다시 주기" }] : []),
    ...(pending ? [{ mode: "update" as const, label: "수정" }] : []),
    ...(account.is_active ? [{ mode: "studentNo" as const, label: "학번 정정" }] : []),
    ...(pending ? [{ mode: "cancel" as const, label: "등록 취소" }] : []),
    ...(!activated ? [{ mode: "delete" as const, label: "명단에서 삭제", danger: true }] : []),
  ];
  if (items.length === 0) return null;

  const open = () => {
    setMode("menu");
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const back = (
    <Button variant="secondary" onClick={() => setMode("menu")}>
      ← 뒤로
    </Button>
  );

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`${account.email} 설정`}
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
            <h2 id={`${id}-title`} className="font-semibold">승인 명단 설정</h2>
            <p className="break-all text-sm text-zinc-600 dark:text-zinc-400">{account.email}</p>
          </div>
          <button
            type="button"
            onClick={close}
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

        {mode === "update" && (
          <form action={update} className="space-y-3">
            <input type="hidden" name="accountId" value={account.id} />
            {!director && (
              <>
                <SelectField id={`${id}-role`} name="role" label="역할" options={roleOptions}
                  value={role} onChange={(event) => setRole(event.target.value)} />
                <SelectField id={`${id}-department`} name="departmentId" label="부서"
                  options={departments} placeholder="부서 없음" value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  error={fieldError(updated, "departmentId")} />
              </>
            )}
            <SelectField id={`${id}-position`} name="positionId" label="직책"
              options={positions} placeholder="직책 없음" value={positionId}
              onChange={(event) => setPositionId(event.target.value)} />
            <div className="flex gap-2">{back}<SubmitButton>수정 저장</SubmitButton></div>
            <FormMessage state={updated} />
          </form>
        )}

        {mode === "studentNo" && (
          <form action={correct} className="space-y-3">
            <input type="hidden" name="accountId" value={account.id} />
            <TextField id={`${id}-student`} name="studentNo" label="새 학번" inputMode="numeric"
              autoComplete="off" hint="숫자 10자리" value={studentNo}
              onChange={(event) => setStudentNo(event.target.value)}
              error={fieldError(corrected, "studentNo")} />
            <div className="flex gap-2">{back}<SubmitButton>학번 저장</SubmitButton></div>
            <FormMessage state={corrected} />
          </form>
        )}

        {mode === "cancel" && (
          <form action={cancel} className="space-y-3">
            <p className="text-sm">승인 등록을 취소할까요? 기록은 “등록 취소”로 남고, 이 사람이 로그인해도 구성원이 되지 않습니다.</p>
            <input type="hidden" name="accountId" value={account.id} />
            <input type="hidden" name="confirm" value="yes" />
            <div className="flex gap-2">{back}<SubmitButton variant="secondary">등록 취소</SubmitButton></div>
            <FormMessage state={cancelled} />
          </form>
        )}

        {mode === "reactivate" && (
          <form action={reactivate} className="space-y-3">
            <p className="text-sm">소속을 종료한 이 사람에게 학생회 권한을 다시 줍니다. 역할·부서·직책은 이 명단에 적힌 대로 돌아가고, 바꾸려면 다시 준 뒤 &quot;활동 중인 구성원&quot;에서 고쳐 주세요.</p>
            <input type="hidden" name="accountId" value={account.id} />
            <div className="flex gap-2">{back}<SubmitButton>권한 다시 주기</SubmitButton></div>
            <FormMessage state={reactivated} />
          </form>
        )}

        {mode === "delete" && (
          <form action={remove} className="space-y-3">
            <p className="text-sm">명단에서 완전히 삭제할까요? 되돌릴 수 없습니다. 삭제한 뒤 같은 이메일을 다시 등록할 수 있습니다.</p>
            <input type="hidden" name="accountId" value={account.id} />
            <input type="hidden" name="confirm" value="yes" />
            <div className="flex gap-2">{back}<SubmitButton>삭제</SubmitButton></div>
            <FormMessage state={deleted} />
          </form>
        )}
      </dialog>
    </>
  );
}
