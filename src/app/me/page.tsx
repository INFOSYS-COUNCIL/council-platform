import type { Metadata } from "next";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SecondaryLinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "내 계정",
};

const ROLE_LABELS = {
  EXECUTIVE: "회장단",
  DIRECTOR: "국장",
  MEMBER: "국원",
} as const;

export default function MePage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <PageHeader title="내 계정" />
      <Suspense fallback={<p>계정 정보를 불러오는 중…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  const userId = await requireUser("/me");
  const supabase = await createClient();

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, display_name")
      .eq("id", userId)
      .single(),
    supabase
      .from("memberships")
      .select(
        "id, role, term:terms(name), department:departments(name), position:positions(name)",
      )
      .eq("user_id", userId)
      .eq("is_active", true),
  ]);

  if (profileResult.error || membershipResult.error) {
    return <Alert>계정 정보를 불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  }

  const profile = profileResult.data;
  const memberships = membershipResult.data;

  return (
    <div className="space-y-6">
      {/* 내 계정은 사이드바 밖 화면이라 돌아갈 길을 따로 둔다. 일반 학생은 내 건의로 */}
      <SecondaryLinkButton href={memberships.length > 0 ? "/dashboard" : "/suggestions"}>
        ← {memberships.length > 0 ? "대시보드로 돌아가기" : "내 건의로 돌아가기"}
      </SecondaryLinkButton>
      <dl className="space-y-4 rounded-lg border border-zinc-200 bg-surface p-4 dark:border-zinc-800">
        <div className="space-y-1">
          <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">이메일</dt>
          <dd className="break-all">{profile.email}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-sm font-medium text-zinc-600 dark:text-zinc-400">이름</dt>
          <dd>{profile.display_name ?? "(이름 없음)"}</dd>
        </div>
      </dl>

      <section className="space-y-2">
        <h2 className="border-l-4 border-coral-500 pl-2.5 text-lg font-bold">학생회 소속</h2>
        {memberships.length === 0 ? (
          <p>
            학생회 구성원으로 등록되어 있지 않아 일반 학생으로 로그인했습니다.
            구성원이라면 회장단이나 소속 국장에게 승인 등록을 요청하세요.
          </p>
        ) : (
          <ul className="space-y-1">
            {memberships.map((m) => (
              <li key={m.id}>
                {m.term?.name} · {ROLE_LABELS[m.role]}
                {m.department ? ` · ${m.department.name}` : ""}
                {m.position ? ` · ${m.position.name}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action="/auth/signout" method="post">
        <Button type="submit" variant="secondary">
          로그아웃
        </Button>
      </form>
    </div>
  );
}
