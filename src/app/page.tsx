import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { OrgChart } from "@/components/org/org-chart";
import { SectionPager } from "@/components/section-pager";
import { getActiveMembership, getCurrentUserId } from "@/lib/auth/session";
import { getPublicOrgChart } from "@/lib/org/public-chart";
import { getCouncilProfile } from "@/lib/site";

const PILL = "inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function Home() {
  return (
    <SectionPager className="h-svh overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
      <section className="flex min-h-svh flex-col bg-background">
        <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-10">
          <Link href="/" aria-label="첫 화면" className="flex items-center gap-2.5 rounded-lg font-bold focus-visible:outline-2 focus-visible:outline-accent">
            <Image src="/council-logo.png" alt="" width={36} height={36} className="size-9 rounded-full object-cover" />
            <Suspense fallback="학생회"><CouncilName /></Suspense>
          </Link>
          <nav aria-label="첫 화면 메뉴" className="flex items-center gap-4 text-sm sm:gap-7">
            <Link href="/suggestions/new" className="rounded focus-visible:outline-2 focus-visible:outline-accent">건의하기</Link>
            <a href="#org" className="rounded focus-visible:outline-2 focus-visible:outline-accent">조직도</a>
            <Suspense fallback={<span className="h-12 w-20" />}><AccountButton /></Suspense>
          </nav>
        </header>
        <div className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-5 py-16 sm:px-10 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="space-y-7">
            <Suspense fallback={<h1 className="text-6xl font-bold">학생회</h1>}><Hero /></Suspense>
            <p className="text-lg leading-relaxed text-zinc-700 sm:text-xl dark:text-zinc-300">학과 생활에서 불편한 점, 바라는 점을 들려주세요.<br />학생회가 읽고, 처리 과정과 답변을 공개합니다.</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/suggestions/new" className={`${PILL} bg-accent text-on-accent hover:bg-coral-800 dark:hover:bg-coral-300`}>건의하기 <span aria-hidden="true">→</span></Link>
              <Link href="/suggestions/public" className={`${PILL} border border-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800`}>모두의 건의 보기</Link>
            </div>
            <Suspense fallback={null}><Leaders /></Suspense>
          </div>
          <svg aria-hidden="true" viewBox="0 0 600 440" className="mx-auto w-full max-w-xl">
            <defs><linearGradient id="hero-sun" x2="0.7" y2="1"><stop stopColor="#f7944f" /><stop offset="1" stopColor="#f45b4f" /></linearGradient></defs>
            <path d="M50 300a250 250 0 0 1 500 0" fill="#ffe6da" />
            <path d="M110 300a190 190 0 0 1 380 0" fill="#fbc58a" />
            <path d="M170 300a130 130 0 0 1 260 0" fill="url(#hero-sun)" />
            <path d="M0 300h600" stroke="currentColor" strokeWidth="2" />
            <path d="M85 346h430" stroke="#f9a193" strokeWidth="10" strokeLinecap="round" />
            <path d="M145 388h310" stroke="#facaaa" strokeWidth="7" strokeLinecap="round" />
            <path d="M205 424h190" stroke="#fbd5ad" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
      </section>
      <section id="suggest" aria-labelledby="suggest-title" className="flex min-h-svh items-center bg-[#2a1a15] px-5 py-20 text-[#fff8f0] sm:px-10">
        <div className="mx-auto w-full max-w-6xl space-y-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 id="suggest-title" className="text-3xl font-bold tracking-tight sm:text-5xl">건의는 세 단계면 끝나요</h2>
            <p className="max-w-sm text-sm leading-relaxed text-[#d6c1b5]">작성자 이름은 회장·부회장만 봅니다. 다른 학생에게는 보이지 않아요.</p>
          </div>
          <ol className="grid gap-8 md:grid-cols-3">
            {[
              ["학교 계정으로 로그인", "@hanyang.ac.kr Google 계정이면 누구나 건의할 수 있어요."],
              ["불편한 점, 바라는 점 남기기", "학과 생활에 관한 건의면 무엇이든 괜찮아요."],
              ["처리 상태와 답변 확인", "접수됨 → 검토 중 → 답변 완료. ‘내 건의’에서 언제든 볼 수 있어요."],
            ].map(([title, description], i) => (
              <li key={title} className="space-y-2 border-t border-[#ff8a75] pt-5">
                <span className="text-sm font-semibold text-[#ffb08a]">0{i + 1}</span>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-[#d6c1b5]">{description}</p>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-3">
            <Link href="/suggestions/new" className={`${PILL} bg-[#ff8a75] text-[#2a1a15] hover:bg-[#ffb08a]`}>지금 건의하기 <span aria-hidden="true">→</span></Link>
            <Link href="/suggestions" className={`${PILL} border border-[#d6c1b5] hover:bg-white/10`}>내 건의 보기</Link>
          </div>
        </div>
      </section>
      <section id="org" aria-labelledby="org-title" className="flex min-h-svh flex-col justify-center bg-background px-5 py-20 sm:px-10">
        <div className="mx-auto w-full max-w-5xl space-y-10">
          <h2 id="org-title" className="text-center text-3xl font-bold tracking-tight">조직도</h2>
          <Suspense fallback={<p role="status" className="text-center">불러오는 중…</p>}><PublicOrg /></Suspense>
        </div>
      </section>
    </SectionPager>
  );
}

async function CouncilName() {
  return (await getCouncilProfile()).name;
}

async function Hero() {
  const profile = await getCouncilProfile();
  return <><p className="text-sm font-semibold text-accent">한양대학교 정보시스템학과 {profile.generation ? `제 ${profile.generation}대 ` : ""}학생회</p><h1 className="mt-5 text-7xl leading-tight font-bold tracking-tight sm:text-9xl lg:text-[10rem]">{profile.name}</h1></>;
}

async function Leaders() {
  const chart = await getPublicOrgChart().catch(() => null);
  return chart?.executives.length ? <p className="text-sm text-muted">{chart.executives.map((p) => `${p.position ?? "회장단"} ${p.name}`).join(" · ")}</p> : null;
}

async function PublicOrg() {
  const chart = await getPublicOrgChart().catch(() => null);
  if (!chart) return <p className="text-center text-sm text-muted">조직도를 불러오지 못했습니다.</p>;
  return <OrgChart {...chart} />;
}

async function AccountButton() {
  const userId = await getCurrentUserId();
  const membership = userId ? await getActiveMembership() : null;
  return <Link href={!userId ? "/login" : membership ? "/dashboard" : "/suggestions"} className={`${PILL} min-h-10 bg-foreground px-4 py-2 text-background hover:opacity-85`}>{!userId ? "로그인" : membership ? "대시보드" : "내 건의"}</Link>;
}
