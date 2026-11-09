import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/auth/roles";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AccountActions } from "./account-actions";
import { BulkForm } from "./bulk-form";
import { readApprovedAccounts, readOrganisation } from "./queries";
import { SingleForm } from "./single-form";

export const metadata: Metadata = {
  title: "가입 승인 명단",
};

const ROUTE = ADMIN_ROUTES.approvedAccounts;
const columns = ["이메일", "학번", "부서", "역할", "직책", "상태", "관리"];

export default function ApprovedAccountsPage() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="가입 승인 명단" description="학생회로 받아 줄 사람을 미리 등록합니다. 등록된 사람이 학교 Google 계정으로 로그인하면 활동 중인 구성원이 됩니다." />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <ApprovedAccountsContent />
      </Suspense>
    </div>
  );
}

async function ApprovedAccountsContent() {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const director = membership.role === "DIRECTOR" ? { departmentId: membership.departmentId } : null;
  const [accounts, organisation] = await Promise.all([
    readApprovedAccounts(supabase, membership.termId, director),
    readOrganisation(supabase, membership.termId),
  ]);

  if (accounts.error || !organisation) {
    return <Alert>승인 명단을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>;
  }

  const { departments, positions } = organisation;
  const departmentById = new Map(departments.map((department) => [department.id, department]));
  const positionById = new Map(positions.map((position) => [position.id, position]));
  const sorted = accounts.data.toSorted((a, b) => {
    const orderA = departmentById.get(a.department_id ?? "")?.sort_order ?? Infinity;
    const orderB = departmentById.get(b.department_id ?? "")?.sort_order ?? Infinity;
    return (orderA === orderB ? 0 : orderA - orderB) ||
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.email.localeCompare(b.email);
  });

  return (
    <>
      <SingleForm
        termId={membership.termId}
        director={Boolean(director)}
        departments={departments.filter(({ is_active }) => is_active).map(({ id, name }) => ({ value: id, label: name }))}
        positions={positions.filter(({ is_active }) => is_active).map(({ id, name }) => ({ value: id, label: name }))}
      />
      <BulkForm termId={membership.termId} director={Boolean(director)} />
      {sorted.length === 0 ? (
        <EmptyState title="승인 명단이 비어 있습니다" description="한 명 등록이나 일괄 등록으로 승인할 계정을 추가할 수 있습니다." />
      ) : (
        <div
          role="region"
          aria-label="승인 명단 표"
          tabIndex={0}
          className="max-w-full overflow-x-auto rounded-md border focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="whitespace-nowrap border-b px-3 py-2">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((account) => {
                const activated = Boolean(account.activated_at || account.activated_user_id);
                const canManage = !director || (account.role === "MEMBER" && account.department_id === membership.departmentId);
                return (
                  <tr key={account.id} className="border-b align-top last:border-b-0">
                    <th scope="row" className="px-3 py-2 font-medium">{account.email}</th>
                    <td className="px-3 py-2">{account.student_no ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{departmentById.get(account.department_id ?? "")?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">{ROLE_LABELS[account.role]}</td>
                    <td className="whitespace-nowrap px-3 py-2">{positionById.get(account.position_id ?? "")?.name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {activated ? "로그인 완료" : account.is_active ? "로그인 대기" : "등록 취소"}
                    </td>
                    <td className="px-3 py-2">
                      {canManage && <AccountActions
                        account={account}
                        activated={activated}
                        director={Boolean(director)}
                        departments={departments
                          .filter(({ is_active, id }) => is_active || id === account.department_id)
                          .map(({ id, name }) => ({ value: id, label: name }))}
                        positions={positions
                          .filter(({ is_active, id }) => is_active || id === account.position_id)
                          .map(({ id, name }) => ({ value: id, label: name }))}
                      />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
