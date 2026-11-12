import type { Metadata } from "next";
import { Suspense } from "react";
import { GoogleLoginButton } from "./google-login-button";
import { LoginError } from "./login-error";
import { SunsetScene } from "@/components/sunset-scene";
import { safeNextPath } from "@/lib/auth/redirect";
import { getPlatformName } from "@/lib/site";

export const metadata: Metadata = {
  title: "로그인",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <main className="relative isolate flex min-h-screen flex-1 flex-col overflow-hidden">
      <SunsetScene className="absolute inset-0 -z-10 size-full" />
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white/80 p-6 shadow-[0_20px_60px_-20px_rgb(244_91_79/0.35)] ring-1 ring-white/70 backdrop-blur-md sm:p-8 dark:bg-zinc-900/85 dark:ring-zinc-800">
          <div className="space-y-3">
            <span
              aria-hidden="true"
              className="bg-coral-gradient grid size-10 place-items-center rounded-lg text-sm font-bold text-zinc-950"
            >
              IS
            </span>
            <h1 className="text-xl font-semibold tracking-tight">
              <Suspense fallback="학생회">
                <PlatformName />
              </Suspense>{" "}
              로그인
            </h1>
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

async function PlatformName() {
  return await getPlatformName();
}
