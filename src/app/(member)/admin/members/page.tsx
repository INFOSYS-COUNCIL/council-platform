import type { Metadata } from "next";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/form-field";
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
  title: "활동 중인 구성원",
};

const ROUTE = ADMIN_ROUTES.members;

// 현재 기수 활성 구성원 목록(기획서 부록 C.3). 회장단은 역할·부서·직책 변경과 종료,
// 국장은 자기 국만 보고 자기 국 국원만 종료한다. 실제 권한은 RPC가 다시 검사한다.
export default function MembersPage(props: PageProps<"/admin/members">) {
  return (
    <div className="min-w-0 space-y-6">
      <PageHeader title="활동 중인 구성원" />
      <Suspense fallback={<p role="status">불러오는 중…</p>}>
        <MembersContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function MembersContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>>; }) {
  const membership = await requireMember(ROUTE.href, ROUTE.roles);
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const supabase = await createClient();
  const isExecutive = membership.role === "EXECUTIVE";
  const director = isExecutive ? null : { departmentId: membership.departmentId };
  const [members, organisation, studentNos] = await Promise.all([
    readMembers(supabase, membership.termId, director),
    readOrganisation(supabase, membership.termId),
    // 회장단은 구성원 모두의 학번·연락처(이메일)를 본다. 학번은 승인 명단에 있고 RLS가 회장단에게만 기수 전체를 돌려준다
    isExecutive
      ? supabase
        .from("approved_council_accounts")
        .select("activated_user_id, student_no")
        .eq("term_id", membership.termId)
        .not("activated_user_id", "is", null)
      : null,
  ]);
  const studentNoOf = new Map((studentNos?.data ?? []).map((a) => [a.activated_user_id, a.student_no]));
  const columns = isExecutive
    ? ["이름", "학번", "연락처", "부서", "역할", "직책", "관리"]
    : ["이름", "부서", "역할", "직책", "관리"];

  if (members.error || !organisation) {
    return <Alert>구성원을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</Alert>;
  }

  const { departments, positions } = organisation;
  const departmentById = new Map(departments.map((d) => [d.id, d]));
  const positionById = new Map(positions.map((p) => [p.id, p]));
  const allRows = sortMembers(
    members.data.map((m) => ({ ...m, name: m.profile?.display_name || m.profile?.email || "(알 수 없음)" })),
    new Map(departments.map((d) => [d.id, d.sort_order])),
  );

  const rows = allRows.filter((member) => `${member.name} ${studentNoOf.get(member.user_id) ?? ""} ${departmentById.get(member.department_id ?? "")?.name ?? ""} ${member.profile?.email ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  if (allRows.length === 0) {
    return <EmptyState title="활동 중인 구성원이 없습니다" description="승인 명단에 등록된 사람이 로그인하면 여기에 나타납니다." />;
  }

  return (
    <div className="space-y-4">
      <form className="flex items-end gap-2" action="/admin/members">
        <div className="min-w-0 flex-1"><TextField label="구성원 검색" name="q" type="search" defaultValue={search} placeholder="이름·학번·부서 검색" /></div>
        <Button type="submit" variant="secondary">검색</Button>
      </form>
      <p className="text-sm text-muted">활동 중 {allRows.length}명{search && ` · 검색 결과 ${rows.length}명`}</p>
      {rows.length === 0 && <EmptyState title="검색 결과가 없습니다" description="이름이나 부서를 다시 확인해 주세요." />}
      <div
        role="region"
        aria-label="구성원 표"
        tabIndex={0}
        className="max-w-full overflow-x-auto rounded-xl border border-zinc-200 bg-surface focus-visible:outline-2 focus-visible:outline-accent dark:border-zinc-800"
      >
        <table className="block w-full text-left text-sm md:table">
          <thead className="hidden md:table-header-group">
            <tr>
              {columns.map((column) => (
                <th key={column} scope="col" className="whitespace-nowrap border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="block md:table-row-group">
            {rows.map((m) => {
              const departmentName = departmentById.get(m.department_id ?? "")?.name ?? null;
              const isMe = m.id === membership.id;
              return (
                <tr key={m.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 p-4 md:table-row md:p-0 border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
                  <th scope="row" className="min-w-0 text-left font-medium md:px-3 md:py-3">
                    {m.name}
                    {isMe && <span className="ml-1 text-xs font-normal text-zinc-600 dark:text-zinc-400">(나)</span>}
                    <span className="ml-2 inline-block md:hidden"><Badge tone={m.role === "DIRECTOR" ? "info" : "neutral"}>{ROLE_LABELS[m.role]}</Badge></span>
                    <span className="mt-1 block text-xs font-normal text-muted md:hidden">{[departmentName, positionById.get(m.position_id ?? "")?.name].filter(Boolean).join(" · ") || "소속 부서 없음"}{isExecutive && ` · ${studentNoOf.get(m.user_id) ?? "학번 미등록"}`}</span>
                    {isExecutive && m.profile?.email && <a href={`mailto:${m.profile.email}`} className="mt-1 block break-all text-xs font-normal text-muted md:hidden">{m.profile.email}</a>}

                  </th>
                  {isExecutive && (
                    <>
                      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell tabular-nums">{studentNoOf.get(m.user_id) ?? "—"}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">
                        {m.profile?.email ? <a href={`mailto:${m.profile.email}`} className="underline">{m.profile.email}</a> : "—"}
                      </td>
                    </>
                  )}
                  <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{departmentName ?? "—"}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{ROLE_LABELS[m.role]}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 md:table-cell">{positionById.get(m.position_id ?? "")?.name ?? "—"}</td>
                  <td className="col-start-2 row-start-1 md:px-3 md:py-2">
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
    </div>
  );
}
