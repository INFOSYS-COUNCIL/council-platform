import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "정보시스템학과 학생회 운영 플랫폼",
};

const FEATURES = [
  { title: "업무", text: "국별·개인별 업무와 마감을 한눈에" },
  { title: "회의록", text: "회의 결과를 기록하고 업무로 연결" },
  { title: "일정", text: "이번 주 학생회 일정을 함께" },
  { title: "건의", text: "학우 건의 접수부터 처리 결과까지" },
] as const;

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <div aria-hidden="true" className="bg-coral-gradient h-1 shrink-0" />
      <div className="flex flex-1 items-center justify-center px-4 py-16 sm:px-6">
        <div className="flex w-full max-w-2xl flex-col items-center text-center">
          <span
            aria-hidden="true"
            className="bg-coral-gradient grid size-12 place-items-center rounded-xl text-base font-bold text-zinc-950 shadow-sm"
          >
            IS
          </span>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
            정보시스템학과 학생회 운영 플랫폼
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-600 sm:text-lg dark:text-zinc-400">
            학생회 업무와 기록을 한곳에서 관리하고, 다음 기수에 남깁니다.
          </p>
          <Link
            href="/login"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-md bg-coral-700 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-coral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-coral-400 dark:text-zinc-950 dark:hover:bg-coral-300"
          >
            학교 Google 계정으로 로그인
          </Link>
          <ul className="mt-12 grid w-full gap-3 text-left sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li
                key={f.title}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{f.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
