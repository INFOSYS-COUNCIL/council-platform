import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "정보시스템학과 학생회 운영 플랫폼",
};

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-6 py-16 font-sans dark:bg-zinc-950">
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
          정보시스템학과 학생회 운영 플랫폼
        </h1>
        <p className="mt-5 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
          학생회 업무와 기록을 한곳에서 관리합니다.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-zinc-950 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-50"
        >
          학교 Google 계정으로 로그인
        </Link>
      </div>
    </main>
  );
}
