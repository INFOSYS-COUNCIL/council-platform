import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Section, Skeleton } from "@/components/ui/detail";
import { DialogButton } from "@/components/ui/dialog-button";
import { TextField } from "@/components/ui/form-field";
import { FOCUS_RING } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireMember } from "@/lib/auth/session";
import { getTermOrgOptions } from "@/lib/org/options";
import { createClient } from "@/lib/supabase/server";
import { createGuide } from "./actions";

export const metadata: Metadata = {
  title: "국별 업무 자료 및 가이드라인",
};

// 업무 공간 > 국별 업무 자료 및 가이드라인(4차 사용 피드백).
// 노션의 국별 가이드 페이지처럼, 국마다 "이 업무는 이렇게 한다" 페이지를 모아 둔다. 신입 부원이 자기 국 가이드를 읽고 업무를 처리한다.
// 가이드는 기록 > 페이지와 같은 편집기를 쓴다. 학생회 전체가 읽고, 회장단·그 국 국장·만든 사람이 쓴다(DB가 검사).
export default function GuidesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="국별 업무 자료 및 가이드라인"
        description="국마다 업무를 처리하는 방법과 자료를 모아 둡니다. 행사 이름을 태그로 달면 행사별로 찾기 쉽습니다."
      />
      <Suspense fallback={<Skeleton />}>
        <GuidesContent />
      </Suspense>
    </div>
  );
}

async function GuidesContent() {
  const membership = await requireMember("/guides");
  const supabase = await createClient();
  const [{ data, error }, org] = await Promise.all([
    supabase
      .from("meeting_minutes")
      .select("id, title, tags, guide_department_id")
      .eq("term_id", membership.termId)
      .not("guide_department_id", "is", null)
      .order("title"),
    getTermOrgOptions(membership.termId),
  ]);
  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  if (org.departments.length === 0) return <p className="text-sm">아직 등록된 국이 없습니다.</p>;

  // 내 국을 맨 위에
  const departments = [...org.departments].sort(
    (a, b) => Number(b.id === membership.departmentId) - Number(a.id === membership.departmentId),
  );
  const canWrite = (deptId: string) =>
    membership.role === "EXECUTIVE" || (membership.role === "DIRECTOR" && membership.departmentId === deptId);

  return (
    <div className="space-y-8">
      {departments.map((d) => {
        const guides = data.filter((g) => g.guide_department_id === d.id);
        return (
          <Section
            key={d.id}
            title={d.id === membership.departmentId ? `${d.name} (내 국)` : d.name}
            action={
              canWrite(d.id) && (
                <DialogButton label="+ 가이드 추가">
                  <ActionForm action={createGuide} submitLabel="만들고 쓰기">
                    <input type="hidden" name="department_id" value={d.id} />
                    <TextField label="제목" name="title" required maxLength={100} hint="예: 개강총회 공지글 쓰는 법" />
                    <TextField label="태그" name="tags" hint="행사 이름 등을 쉼표로 나눠 적습니다. 예: 개강총회, 공지" />
                  </ActionForm>
                </DialogButton>
              )
            }
          >
            {guides.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">아직 가이드가 없습니다.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {guides.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/pages/${g.id}`}
                      className={`flex h-full flex-col gap-1.5 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm hover:border-coral-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-coral-800 ${FOCUS_RING}`}
                    >
                      <span className="font-semibold">{g.title}</span>
                      {g.tags.length > 0 && (
                        <span className="flex flex-wrap gap-1.5">
                          {g.tags.map((t) => (
                            <Badge key={t} tone="muted">{`#${t}`}</Badge>
                          ))}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        );
      })}
    </div>
  );
}
