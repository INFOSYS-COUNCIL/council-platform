import Link from "next/link";
import { Suspense, type CSSProperties } from "react";
import { OrgChart } from "@/components/org/org-chart";
import { SectionPager } from "@/components/section-pager";
import { getActiveMembership, getCurrentUserId } from "@/lib/auth/session";
import { getPublicOrgChart } from "@/lib/org/public-chart";
import { getCouncilProfile } from "@/lib/site";

const gaonFont = "font-[family-name:var(--font-gaon-serif)]";

const HERO_LINK = "text-[#2a1a15] hover:text-[#00453A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a1a15]";
const HERO_PILL = `inline-flex items-center rounded-full text-[17px] font-bold ${HERO_LINK}`;

// 유리 원 위치·크기(시안 그대로). size 외 값은 막·반사광 두께와 흐림 정도
type BubbleSpec = { size: number; pos: CSSProperties; film: number; soft: number; hi: number; lo: number; sp: number; specks?: [string, string][] };
const BUBBLES: BubbleSpec[] = [
  { size: 680, pos: { right: -80, top: 110 }, film: 14, soft: 4, hi: 12, lo: 6, sp: 6, specks: [["30%", "32%"], ["44%", "46%"]] },
  { size: 150, pos: { right: 530, top: 640 }, film: 5, soft: 1.5, hi: 4, lo: 2, sp: 3, specks: [["34%", "30%"]] },
  { size: 56, pos: { right: 590, top: 132 }, film: 3, soft: 1, hi: 2, lo: 1, sp: 2 },
  { size: 92, pos: { right: 40, top: 58 }, film: 4, soft: 1.4, hi: 4, lo: 2, sp: 2, specks: [["32%", "30%"]] },
  { size: 110, pos: { right: 250, top: 770 }, film: 5, soft: 1.6, hi: 4, lo: 2, sp: 2, specks: [["33%", "30%"]] },
  { size: 36, pos: { right: 470, top: 596 }, film: 2, soft: 0.8, hi: 2, lo: 1, sp: 2 },
  { size: 26, pos: { right: 700, top: 268 }, film: 2, soft: 0.8, hi: 2, lo: 1, sp: 2 },
  { size: 64, pos: { right: 700, top: 470 }, film: 3, soft: 0.9, hi: 2, lo: 1, sp: 2, specks: [["34%", "30%"]] },
  { size: 44, pos: { left: "3%", top: 118 }, film: 2, soft: 0.8, hi: 2, lo: 1, sp: 2 },
  { size: 30, pos: { left: "38%", top: 800 }, film: 2, soft: 0.8, hi: 2, lo: 1, sp: 2 },
];

function Bubble({ size, pos, film, soft, hi, lo, sp, specks = [] }: BubbleSpec) {
  const vars = { "--film": `${film}px`, "--soft": `${soft}px`, "--hi": `${hi}px`, "--lo": `${lo}px`, "--sp": `${sp}px` } as CSSProperties;
  return (
    <div aria-hidden="true" className="gaon-bubble" style={{ ...pos, width: size, height: size, backgroundColor: "rgba(255,255,255,0.14)" }}>
      <span className="gaon-film" style={vars} />
      <span className="gaon-hi" style={vars} />
      <span className="gaon-lo" style={vars} />
      {specks.map(([left, top]) => (
        <span key={left + top} className="gaon-speck" style={{ ...vars, left, top }} />
      ))}
    </div>
  );
}

const PILL = "inline-flex min-h-12 items-center justify-center gap-3 rounded-full px-6 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function Home() {
  return (
    <SectionPager className="h-svh overflow-y-auto overscroll-y-contain [overflow-anchor:none]">
      {/* 첫 구역(시안 B): 노을빛 배경 + 유리 원, 왼쪽에 큰 학생회 이름. 색은 다크 모드와 상관없이 고정이다 */}
      <section
        className="home-hero relative flex min-h-svh flex-col overflow-hidden text-[#2a1a15] [word-break:keep-all]"
        style={{
          // QA 3차: "너무 밝고 화사하다" → 채도를 낮춘 모래색 바탕에 은은한 테라코타 빛
          backgroundColor: "#E8DACE",
          backgroundImage:
            "radial-gradient(900px 760px at 102% -4%, #B9766A 0%, #C98F80 28%, rgba(201,143,128,0) 62%), radial-gradient(520px 440px at -4% 104%, #BE8270 0%, #CFA08F 30%, rgba(207,160,143,0) 60%), radial-gradient(760px 640px at 82% 50%, #F1DCC6 0%, #E7C6AE 30%, rgba(231,198,174,0) 72%), radial-gradient(620px 520px at -2% -4%, #D8B4A2 0%, rgba(216,180,162,0) 68%)",
        }}
      >
        {BUBBLES.map((b, i) => (
          <Bubble key={i} {...b} />
        ))}
        <header className="relative mx-auto flex w-full max-w-[1240px] flex-wrap items-center gap-4 px-6 py-5">
          <Link href="/" aria-label="첫 화면" className={`mr-auto flex items-center gap-2.5 rounded-lg ${HERO_LINK}`}>
            <span className={`${gaonFont} text-[22px] tracking-[-0.02em]`}>
              <Suspense fallback="학생회"><CouncilName /></Suspense>
            </span>
          </Link>
          <nav aria-label="페이지 안 이동" className="flex gap-1 text-[15px] font-medium">
            <a href="#suggest" className={`rounded-lg px-3 py-2.5 ${HERO_LINK}`}>건의하기</a>
            <a href="#org" className={`rounded-lg px-3 py-2.5 ${HERO_LINK}`}>조직도</a>
          </nav>
          <Suspense fallback={<span className="h-11 w-24" />}><AccountButton /></Suspense>
        </header>

        <div className="relative mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center gap-7 px-6 pt-10 pb-20">
          <Suspense fallback={<h1 className={`${gaonFont} text-[clamp(64px,11.3vw,162px)] leading-[0.88]`}>학생회</h1>}>
            <Hero />
          </Suspense>
          <div className="flex flex-wrap gap-3">
            <a href="#suggest" className={`${HERO_PILL} min-h-14 gap-2.5 bg-[#fff8f0] px-[30px] shadow-[0_10px_30px_rgba(122,36,27,0.22)]`}>
              건의하기
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </a>
            <Link href="/photos" className={`${HERO_PILL} min-h-14 gap-2.5 bg-[#fff8f0] px-[30px] shadow-[0_10px_30px_rgba(122,36,27,0.22)]`}>
              과 활동
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
          </div>
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

// 학생회 이름(예: 가온) 위에 "한양대학교 정보시스템학과 제 N대 학생회", 아래에 회장단(직책 순)
async function Hero() {
  const [profile, chart] = await Promise.all([getCouncilProfile(), getPublicOrgChart().catch(() => null)]);
  const leaders = chart?.executives ?? [];
  return (
    <>
      <span className={`${gaonFont} gaon-sub -mb-2.5 ml-1 self-start text-2xl tracking-[-0.01em] text-[#5a2118]`}>
        한양대학교 정보시스템학과 {profile.generation ? `제${profile.generation}대 ` : ""}학생회
      </span>
      <h1 className={`${gaonFont} gaon-title m-0 text-[clamp(64px,11.3vw,162px)] leading-[0.88] font-semibold tracking-[-0.02em]`}>
        {profile.name}
      </h1>
      {leaders.length > 0 && (
        <p className="gaon-sub gaon-sub-2 mt-[22px] mb-1.5 ml-1.5 flex flex-wrap items-center gap-x-3.5 gap-y-2.5 text-[19px] leading-snug text-[#3d1f17]">
          {leaders.map((p, i) => (
            <span key={`${p.name}-${i}`} className="contents">
              {i > 0 && <span aria-hidden="true" className="size-1 rounded-full bg-[#5a2118] opacity-70" />}
              <span>
                <span className="font-medium">{p.position ?? "회장단"}</span> <b className="font-bold">{p.name}</b>
              </span>
            </span>
          ))}
        </p>
      )}
    </>
  );
}

async function PublicOrg() {
  const chart = await getPublicOrgChart().catch(() => null);
  if (!chart) return <p className="text-center text-sm text-muted">조직도를 불러오지 못했습니다.</p>;
  return <OrgChart {...chart} />;
}

async function AccountButton() {
  const userId = await getCurrentUserId();
  const membership = userId ? await getActiveMembership() : null;
  return (
    <Link
      href={!userId ? "/login" : membership ? "/dashboard" : "/suggestions"}
      className={`${HERO_PILL} min-h-11 bg-[#fff8f0] px-5 text-[15px] shadow-[0_6px_20px_rgba(122,36,27,0.18)]`}
    >
      {!userId ? "로그인" : membership ? "대시보드" : "내 건의"}
    </Link>
  );
}
