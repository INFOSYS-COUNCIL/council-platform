import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleLoginButton } from "./google-login-button";
import { LoginError } from "./login-error";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "로그인 | 학생회 운영 플랫폼",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="flex min-h-screen flex-1 flex-col">
      <div aria-hidden="true" className="bg-coral-gradient h-1 shrink-0" />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="space-y-3">
            <span
              aria-hidden="true"
              className="bg-coral-gradient grid size-10 place-items-center rounded-lg text-sm font-bold text-zinc-950"
            >
              IS
            </span>
            <h1 className="text-xl font-semibold tracking-tight">학생회 운영 플랫폼 로그인</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              학교 Google 계정(@hanyang.ac.kr)으로만 로그인할 수 있습니다.
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginError searchParams={searchParams} />
          </Suspense>

          <Suspense fallback={<p role="status">로그인 버튼을 불러오는 중…</p>}>
            <LoginButtonWithNext searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function LoginButtonWithNext({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = (await searchParams).next;
  const path = typeof next === "string" ? safeNextPath(next, "") : "";
  return <GoogleLoginButton next={path || undefined} />;
}
