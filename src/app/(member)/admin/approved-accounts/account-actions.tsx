"use client";

import { useActionState, useId, useState } from "react";
import { SelectField, TextField, type SelectOption } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/actions/result";
import { ROLE_LABELS, ROLE_ORDER, type MemberRole } from "@/lib/auth/roles";
import { cancelAccount, correctStudentNo, updateAccount } from "./actions";

const summaryClass = "cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";
const formClass = "mt-2 space-y-2 whitespace-normal";
const roleOptions = ROLE_ORDER.map((role) => ({ value: role, label: ROLE_LABELS[role] }));

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
  director,
  departments,
  positions,
}: {
  account: Account;
  activated: boolean;
  director: boolean;
  departments: SelectOption[];
  positions: SelectOption[];
}) {
  const id = useId();
  const [updated, update] = useActionState(updateAccount, initialActionState);
  const [cancelled, cancel] = useActionState(cancelAccount, initialActionState);
  const [corrected, correct] = useActionState(correctStudentNo, initialActionState);
  const [studentNo, setStudentNo] = useState(account.student_no ?? "");
  const [role, setRole] = useState<string>(account.role);
  const [departmentId, setDepartmentId] = useState(account.department_id ?? "");
  const [positionId, setPositionId] = useState(account.position_id ?? "");

  if (!account.is_active) return <FormMessage state={cancelled} />;

  return (
    <div className="min-w-52 space-y-2">
      {!activated && (
        <>
          <details>
            <summary className={summaryClass}>승인 정보 수정</summary>
            <form action={update} className={formClass}>
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
              <SubmitButton>수정 저장</SubmitButton>
              <FormMessage state={updated} />
            </form>
          </details>
          <details>
            <summary className={summaryClass}>등록 취소</summary>
            <form action={cancel} className={formClass}>
              <p className="break-all">{account.email}의 승인 등록을 취소할까요?</p>
              <input type="hidden" name="accountId" value={account.id} />
              <input type="hidden" name="confirm" value="yes" />
              <SubmitButton variant="secondary">등록 취소 확인</SubmitButton>
              <FormMessage state={cancelled} />
            </form>
          </details>
        </>
      )}
      <details>
        <summary className={summaryClass}>학번 정정</summary>
        <form action={correct} className={formClass}>
          <input type="hidden" name="accountId" value={account.id} />
          <TextField id={`${id}-student`} name="studentNo" label="새 학번" inputMode="numeric"
            autoComplete="off" hint="숫자 10자리" value={studentNo}
            onChange={(event) => setStudentNo(event.target.value)}
            error={fieldError(corrected, "studentNo")} />
          <SubmitButton>학번 저장</SubmitButton>
          <FormMessage state={corrected} />
        </form>
      </details>
    </div>
  );
}
