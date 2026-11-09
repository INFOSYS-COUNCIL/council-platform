"use client";

import { useActionState, useState } from "react";
import { SelectField, TextField, type SelectOption } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/auth/roles";
import { registerAccounts, type BulkState } from "./actions";

// 한 사람씩 입력칸으로 등록한다. 입력값을 일괄 등록과 같은 한 줄(탭 구분)로 만들어
// 같은 검사·등록 흐름(registerAccounts)을 그대로 쓴다.
const roleOptions = ROLE_ORDER.map((role) => ({ value: ROLE_LABELS[role], label: ROLE_LABELS[role] }));
const EMPTY = { email: "", studentNo: "", department: "", role: ROLE_LABELS.MEMBER, position: "" };

export function SingleForm({
  termId,
  director,
  departments,
  positions,
}: {
  termId: string;
  director: boolean;
  departments: SelectOption[];
  positions: SelectOption[];
}) {
  const [values, setValues] = useState(EMPTY);
  const set = (field: keyof typeof EMPTY) => (event: { target: { value: string } }) =>
    setValues({ ...values, [field]: event.target.value });

  const [state, submit] = useActionState(async (): Promise<BulkState> => {
    const columns = director
      ? [values.email, values.studentNo, values.position]
      : [values.email, values.studentNo, values.department, values.role, values.position];
    const form = new FormData();
    // 이름에 탭·줄바꿈이 섞이면 열이 밀리므로 공백으로 바꾼다
    form.set("accounts", columns.map((value) => value.replace(/[\t\r\n]+/g, " ").trim()).join("\t"));
    const result = await registerAccounts(termId, form);
    if (result.result.status === "success") setValues(EMPTY);
    return result;
  }, { result: initialActionState });

  const rowError = state.rows?.[0]?.error;

  return (
    <section aria-labelledby="single-heading" className="space-y-3 rounded-md border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
      <h2 id="single-heading" className="text-lg font-semibold">한 명 등록</h2>
      <form action={submit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <TextField label="이메일" name="email" type="email" required autoComplete="off"
            value={values.email} onChange={set("email")} placeholder="name@hanyang.ac.kr" />
          <TextField label="학번" name="studentNo" required inputMode="numeric" autoComplete="off"
            hint="숫자 10자리" value={values.studentNo} onChange={set("studentNo")} />
          {!director && (
            <>
              <SelectField label="부서" name="department" options={departments.map(({ label }) => ({ value: label, label }))}
                placeholder="부서 없음(회장단)" value={values.department} onChange={set("department")} />
              <SelectField label="역할" name="role" options={roleOptions} value={values.role} onChange={set("role")} />
            </>
          )}
          <SelectField label="직책" name="position" options={positions.map(({ label }) => ({ value: label, label }))}
            placeholder="직책 없음" value={values.position} onChange={set("position")} />
        </div>
        {director && <p className="text-xs text-zinc-600 dark:text-zinc-400">자기 국의 국원으로 등록됩니다.</p>}
        <SubmitButton pendingLabel="등록 중…">등록</SubmitButton>
      </form>
      {state.result.status !== "idle" && (
        <FormMessage state={rowError ? { status: "error", message: rowError } : state.result} />
      )}
    </section>
  );
}
