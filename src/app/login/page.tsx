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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">학생회 운영 플랫폼 로그인</h1>
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
    </main>
  );
}

async function LoginButtonWithNext({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const next = (await searchParams).next;
  const path = typeof next === "string" ? safeNextPath(next, "") : "";
  return <GoogleLoginButton next={path || undefined} />;
}
