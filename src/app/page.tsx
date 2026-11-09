import Link from "next/link";
import { Suspense } from "react";
import { SunsetScene } from "@/components/sunset-scene";
import { getPlatformName } from "@/lib/site";

// 첫 화면: 노을 그림 위에 로고, 플랫폼 이름, 로그인 버튼만 둔다.
// 로고는 임시 "IS". 바꿀 때는 이 파일과 sidebar.tsx·login/page.tsx의 IS 표시를 함께 바꾼다.
export default function Home() {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden">
      <SunsetScene className="absolute inset-0 -z-10 size-full" />
      <div className="flex flex-1 items-end justify-center px-4 pt-16 pb-[14vh]">
        <div className="flex flex-col items-center rounded-3xl bg-white/55 px-8 py-8 text-center shadow-[0_20px_60px_-20px_rgb(244_91_79/0.4)] ring-1 ring-white/70 backdrop-blur-md sm:px-14">
          <span
            aria-hidden="true"
            className="bg-coral-gradient grid size-14 place-items-center rounded-2xl text-lg font-bold text-zinc-950 shadow-sm"
          >
            IS
          </span>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-balance text-zinc-900 sm:text-5xl">
            <Suspense fallback="운영 플랫폼">
              <PlatformName />
            </Suspense>
          </h1>
          <Link
            href="/login"
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-full bg-coral-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-coral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            로그인
          </Link>
        </div>
      </div>
    </main>
  );
}

async function PlatformName() {
  return await getPlatformName();
}
