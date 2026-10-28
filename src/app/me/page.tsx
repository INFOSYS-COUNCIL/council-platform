import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "내 계정 | 학생회 운영 플랫폼",
};

const ROLE_LABELS = {
  EXECUTIVE: "회장단",
  DIRECTOR: "국장",
  MEMBER: "국원",
} as const;

export default function MePage() {
  return (
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <h1 className="text-2xl font-bold">내 계정</h1>
      <Suspense fallback={<p>계정 정보를 불러오는 중…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  const supabase = await createClient();

  // 서버에서는 getClaims()로 JWT를 검증해 로그인 여부를 판단한다. getSession()만으로 판단하지 않는다.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (!userId) {
    redirect("/login");
  }

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
    return (
      <p role="alert" className="text-red-700 dark:text-red-300">
        계정 정보를 불러오지 못했습니다. 새로고침해 주세요.
      </p>
    );
  }

  const profile = profileResult.data;
  const memberships = membershipResult.data;

  return (
    <div className="space-y-6">
      <dl className="space-y-1">
        <dt className="text-sm text-zinc-600 dark:text-zinc-400">이메일</dt>
        <dd>{profile.email}</dd>
        <dt className="text-sm text-zinc-600 dark:text-zinc-400">이름</dt>
        <dd>{profile.display_name ?? "(이름 없음)"}</dd>
      </dl>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">학생회 소속</h2>
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
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-4 py-2 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
