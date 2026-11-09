"use client";

import { useActionState, useState } from "react";
import { TextareaField } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { registerAccounts, type BulkState } from "./actions";

export function BulkForm({ termId, director }: { termId: string; director: boolean }) {
  const [input, setInput] = useState("");
  const [state, submit, pending] = useActionState(
    async (_previous: BulkState, form: FormData) => {
      const result = await registerAccounts(termId, form);
      if (result.retryInput !== undefined) {
        setInput(result.retryInput);
      }
      return result;
    },
    { result: initialActionState },
  );

  return (
    <section aria-labelledby="bulk-heading" className="space-y-3 rounded-md border p-4">
      <h2 id="bulk-heading" className="text-lg font-semibold">일괄 등록</h2>
      <form action={submit} className="space-y-3">
        <TextareaField
          label="승인 명단 붙여넣기"
          name="accounts"
          hint={director
            ? "이메일, 학번, 직책 순으로 셀을 복사하세요. 자기 국의 국원으로 등록됩니다."
            : "이메일, 학번, 부서, 역할, 직책 순으로 셀을 복사하세요. 역할은 회장단, 국장, 국원 중 하나입니다."}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          readOnly={pending}
          rows={5}
          spellCheck={false}
        />
        <SubmitButton>명단 등록</SubmitButton>
      </form>
      {state.result.status !== "idle" && (
        <div className="space-y-2">
          <FormMessage state={state.result} />
          {state.rows && (
            <ol aria-label="행별 등록 결과" className="max-h-60 space-y-1 overflow-auto text-sm">
              {state.rows.map(({ rowNo, email, error }) => (
                <li key={rowNo} className="break-all">
                  {rowNo}행 {email} · {error ? `실패: ${error}` : "등록 완료"}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
