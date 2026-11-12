import Link from "next/link";
import { Suspense } from "react";
import { OrgChart } from "@/components/org/org-chart";
import { SunsetScene } from "@/components/sunset-scene";
import { getActiveMembership, getCurrentUserId } from "@/lib/auth/session";
import { getPublicOrgChart } from "@/lib/org/public-chart";
import { getCouncilProfile } from "@/lib/site";

// 첫 화면(2차 QA): 노을 위에 학생회 이름을 크게, 그 아래 "제 N대 정보시스템학과 학생회"와 회장단(직책 순).
// 스크롤하면 조직도(업무 없이), 그 아래 건의하기 안내. 오른쪽 위에는 로그인 / 대시보드 버튼.
// 로고는 임시 "IS". 바꿀 때는 이 파일과 sidebar.tsx·login/page.tsx의 IS 표시를 함께 바꾼다.
const PILL =
  "inline-flex min-h-10 items-center justify-center rounded-full px-5 py-2 text-sm font-semibold shadow-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative isolate flex min-h-svh flex-col overflow-hidden">
        <SunsetScene className="absolute inset-0 -z-10 size-full" />
        <header className="flex justify-end p-4 sm:p-6">
          <Suspense fallback={<span className="min-h-10" />}>
            <AccountButton />
          </Suspense>
        </header>
        <div className="flex flex-1 items-end justify-center px-4 pb-[12vh]">
          <div className="flex flex-col items-center rounded-3xl bg-white/55 px-8 py-8 text-center shadow-[0_20px_60px_-20px_rgb(244_91_79/0.4)] ring-1 ring-white/70 backdrop-blur-md sm:px-14">
            <span
              aria-hidden="true"
              className="bg-coral-gradient grid size-14 place-items-center rounded-2xl text-lg font-bold text-zinc-950 shadow-sm"
            >
              IS
            </span>
            <Suspense fallback={<h1 className="mt-5 text-4xl font-bold tracking-tight text-zinc-900 sm:text-6xl">학생회</h1>}>
              <Hero />
            </Suspense>
          </div>
        </div>
        <a
          href="#org"
          className="mx-auto mb-6 text-sm font-medium text-zinc-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          조직도 보기 ↓
        </a>
      </section>

      <section id="org" aria-labelledby="org-title" className="bg-background px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-5xl space-y-8">
          <h2 id="org-title" className="text-center text-2xl font-bold tracking-tight">
            조직도
          </h2>
          <Suspense fallback={<p role="status" className="text-center">불러오는 중…</p>}>
            <PublicOrg />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="suggest-title" className="bg-coral-50 px-4 py-16 sm:px-8 dark:bg-zinc-900">
        <div className="mx-auto max-w-2xl space-y-4 text-center">
          <h2 id="suggest-title" className="text-2xl font-bold tracking-tight">
            학생회에 건의하기
          </h2>
          <p className="text-zinc-700 dark:text-zinc-300">
            학과 생활에서 불편한 점, 바라는 점을 학생회에 남겨 주세요. 학교 계정으로 로그인하면 누구나 건의할 수 있고,
            처리 상태와 학생회 답변은 내 건의에서 확인할 수 있습니다. 작성자 이름은 회장·부회장만 봅니다.
          </p>
          {/* 로그인하지 않았으면 건의하기 화면이 로그인으로 보낸 뒤 돌아온다 */}
          <Link href="/suggestions/new" className={`${PILL} min-h-12 bg-coral-700 px-8 text-base text-white hover:bg-coral-800`}>
            건의하기
          </Link>
        </div>
      </section>
    </main>
  );
}

async function Hero() {
  const [profile, chart] = await Promise.all([getCouncilProfile(), getPublicOrgChart().catch(() => null)]);
  const leaders = chart?.executives ?? [];
  return (
    <>
      <h1 className="mt-5 text-4xl font-bold tracking-tight text-balance text-zinc-900 sm:text-6xl">{profile.name}</h1>
      <p className="mt-3 text-base font-medium text-zinc-800 sm:text-lg">
        {profile.generation ? `제 ${profile.generation}대 ` : ""}정보시스템학과 학생회
      </p>
      {leaders.length > 0 && (
        <p className="mt-2 text-sm text-zinc-700">
          {leaders.map((p) => `${p.position ?? "회장단"} ${p.name}`).join(" · ")}
        </p>
      )}
    </>
  );
}

async function PublicOrg() {
  const chart = await getPublicOrgChart().catch(() => null);
  if (!chart) return <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">조직도를 불러오지 못했습니다.</p>;
  return <OrgChart {...chart} />;
}

// 로그인 전: 로그인 / 학생회 구성원: 대시보드 / 그 밖의 학생: 내 건의
async function AccountButton() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return (
      <Link href="/login" className={`${PILL} bg-coral-700 text-white hover:bg-coral-800`}>
        로그인
      </Link>
    );
  }
  const membership = await getActiveMembership();
  return membership ? (
    <Link href="/dashboard" className={`${PILL} bg-coral-700 text-white hover:bg-coral-800`}>
      대시보드로 가기
    </Link>
  ) : (
    <Link href="/suggestions" className={`${PILL} bg-white text-zinc-900 hover:bg-zinc-100`}>
      내 건의
    </Link>
  );
}
