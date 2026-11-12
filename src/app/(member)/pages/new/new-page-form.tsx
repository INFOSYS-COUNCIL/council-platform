"use client";

import { useActionState } from "react";
import type { SelectOption } from "@/components/ui/form-field";
import { FormMessage } from "@/components/ui/form-message";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState } from "@/lib/actions/result";
import { createPage } from "../actions";
import { PageFields } from "../page-fields";

export function NewPageForm({ departments, members }: { departments: SelectOption[]; members: SelectOption[] }) {
  const [state, formAction] = useActionState(createPage, initialActionState);
  const errors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  return (
    <form action={formAction} className="max-w-2xl space-y-5">
      <PageFields departments={departments} members={members} errors={errors} />
      <FormMessage state={state} />
      <SubmitButton>페이지 만들기</SubmitButton>
    </form>
  );
}
