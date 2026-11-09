import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { requireMember } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readOrganisation } from "../approved-accounts/queries";
import { MemberActions } from "./member-actions";
import { readMembers } from "./queries";
import { sortMembers } from "./sort";

export const metadata: Metadata = {
  title: "구성원",
};

const ROUTE = ADMIN_ROUTES.members;
const columns = ["이름", "부서", "역할", "직책", "관리"];

// 현재 기수 활성 구성원 목록(기획서 부록 C.3). 회장단은 역할·부서·직책 변경과 종료,
// 국장은 자기 국만 보고 자기 국 국원만 종료한다. 실제 권한은 RPC가 다시 검사한다.
export default function MembersPage() {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="구성원" description="학생회에 로그인해 활동 중인 사람입니다. 아직 로그인 전인 사람은 승인 명단에서 봅니다." />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <MembersContent />
      </Suspense>
    </div>
  );
}

async function MembersContent() {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const supabase = await createClient();
  const isExecutive = membership.role === "EXECUTIVE";
  const director = isExecutive ? null : { departmentId: membership.departmentId };
  const [members, organisation] = await Promise.all([
    readMembers(supabase, membership.termId, director),
    readOrganisation(supabase, membership.termId),
  ]);

  if (members.error || !organisation) {
    return <Alert>구성원을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>;
  }

  const { departments, positions } = organisation;
  const departmentById = new Map(departments.map((d) => [d.id, d]));
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const rows = sortMembers(
    members.data.map((m) => ({ ...m, name: m.profile?.display_name || m.profile?.email || "(알 수 없음)" })),
    new Map(departments.map((d) => [d.id, d.sort_order])),
  );

  if (rows.length === 0) {
    return <EmptyState title="활동 중인 구성원이 없습니다" description="승인 명단에 등록된 사람이 로그인하면 여기에 나타납니다." />;
  }

  return (
    <div
      role="region"
      aria-label="구성원 표"
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-md border border-zinc-200 bg-surface focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-zinc-800"
    >
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => {
            const departmentName = departmentById.get(m.department_id ?? "")?.name ?? null;
            const isMe = m.id === membership.id;
            return (
              <tr key={m.id} className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
                <th scope="row" className="px-3 py-2 font-medium">
                  {m.name}
                  {isMe && <span className="ml-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">(나)</span>}
                </th>
                <td className="whitespace-nowrap px-3 py-2">{departmentName ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2">{ROLE_LABELS[m.role]}</td>
                <td className="whitespace-nowrap px-3 py-2">{positionById.get(m.position_id ?? "")?.name ?? "—"}</td>
                <td className="px-3 py-2">
                  <MemberActions
                    member={m}
                    departmentName={departmentName}
                    canChangeRole={isExecutive}
                    canEnd={isExecutive || (m.role === "MEMBER" && !isMe)}
                    departments={departments
                      .filter(({ is_active, id }) => is_active || id === m.department_id)
                      .map(({ id, name }) => ({ value: id, label: name }))}
                    positions={positions
                      .filter(({ is_active, id }) => is_active || id === m.position_id)
                      .map(({ id, name }) => ({ value: id, label: name }))}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
