import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { ManageMenu } from "@/components/ui/manage-menu";
import { PageHeader } from "@/components/ui/page-header";
import { PillLink } from "@/components/ui/pagination";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDateTime, todayInSeoul } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { deletePage } from "./actions";

export const metadata: Metadata = {
  title: "페이지",
};

// 기록 > 페이지 목록: 검색(제목), 태그로 거르기, 날짜 정렬, 태그별로 묶어 보기, 추가·삭제.
// 볼 수 있는 페이지만 RLS가 돌려준다. shortcut: 쪽 나누기 없이 최근 200개. 넘으면 쪽 나누기를 붙인다
export default function PagesPage(props: PageProps<"/pages">) {
  return (
    <div className="space-y-6">
      <PageHeader title="페이지" actions={<LinkButton href="/pages/new">페이지 만들기</LinkButton>} />
      <Suspense fallback={<Skeleton />}>
        <PagesContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

type Row = { id: string; title: string; tags: string[]; meeting_at: string; created_by: string };

async function PagesContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const membership = await requireMember("/pages");
  const me = await getCurrentUserId();
  const raw = await searchParams;
  const q = typeof raw.q === "string" ? raw.q.trim().slice(0, 50) : "";
  const tag = typeof raw.tag === "string" ? raw.tag : "";
  const sort: "desc" | "asc" = raw.sort === "asc" ? "asc" : "desc";
  const grouped = raw.group === "tag";
  const href = (change: Partial<{ tag: string; sort: string; group: boolean }>) => {
    const next = { tag, sort, group: grouped, ...change };
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (next.tag) p.set("tag", next.tag);
    if (next.sort === "asc") p.set("sort", "asc");
    if (next.group) p.set("group", "tag");
    return p.size ? `/pages?${p}` : "/pages";
  };

  const supabase = await createClient();
  let query = supabase
    .from("meeting_minutes")
    .select("id, title, tags, meeting_at, created_by")
    .eq("term_id", membership.termId)
    .eq("kind", "PAGE");
  // 검색어의 %·_는 글자 그대로 찾는다
  if (q) query = query.ilike("title", `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  if (tag) query = query.contains("tags", [tag]);
  const { data, error } = await query.order("meeting_at", { ascending: sort === "asc" }).limit(200);

  if (error) return <Alert>불러오지 못했습니다. 새로고침해 주세요.</Alert>;
  const today = todayInSeoul();
  const isExecutive = membership.role === "EXECUTIVE";
  const allTags = [...new Set(data.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, "ko"));

  const list = (rows: Row[]) => (
    <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
      {rows.map((p) => (
        <li key={p.id} className="flex items-center gap-2 pr-2">
          <Link href={`/pages/${p.id}`} className={`flex min-w-0 flex-1 flex-col gap-1 p-4 hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
            <span className="truncate font-semibold">{p.title}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
              {formatDateTime(p.meeting_at, today)}
              {p.tags.map((t) => (
                <Badge key={t} tone="muted">#{t}</Badge>
              ))}
            </span>
          </Link>
          {(isExecutive || p.created_by === me) && (
            <ManageMenu
              title="페이지 관리"
              subtitle={p.title}
              items={[
                {
                  key: "delete",
                  label: "삭제",
                  danger: true,
                  content: (
                    <ActionForm action={deletePage} submitLabel="삭제">
                      <input type="hidden" name="page_id" value={p.id} />
                      <p className="text-sm">이 페이지를 지웁니다. 되돌릴 수 없습니다.</p>
                    </ActionForm>
                  ),
                },
              ]}
            />
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {/* GET 폼이라 JavaScript 없이도 검색된다 */}
        <form action="/pages" role="search" className="flex items-center gap-2">
          {tag && <input type="hidden" name="tag" value={tag} />}
          {sort === "asc" && <input type="hidden" name="sort" value="asc" />}
          {grouped && <input type="hidden" name="group" value="tag" />}
          <label htmlFor="pages-q" className="sr-only">
            제목 검색
          </label>
          <input
            id="pages-q"
            name="q"
            defaultValue={q}
            placeholder="제목 검색"
            className={`h-9 w-48 rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 ${FOCUS_RING}`}
          />
        </form>
        <nav aria-label="정렬과 보기" className="flex flex-wrap gap-2 text-sm">
          <PillLink href={href({ sort: "desc" })} current={sort === "desc"}>
            최신 날짜순
          </PillLink>
          <PillLink href={href({ sort: "asc" })} current={sort === "asc"}>
            오래된 날짜순
          </PillLink>
          <PillLink href={href({ group: !grouped })} current={grouped}>
            태그별로 묶어 보기
          </PillLink>
        </nav>
      </div>

      {allTags.length > 0 && (
        <nav aria-label="태그로 거르기" className="flex flex-wrap gap-2 text-sm">
          <PillLink href={href({ tag: "" })} current={!tag}>
            모든 태그
          </PillLink>
          {allTags.map((t) => (
            <PillLink key={t} href={href({ tag: t })} current={tag === t}>
              {`#${t}`}
            </PillLink>
          ))}
        </nav>
      )}

      {data.length === 0 ? (
        <EmptyState
          title={q || tag ? "찾는 페이지가 없습니다." : "아직 페이지가 없습니다."}
          action={<LinkButton href="/pages/new">+ 페이지 만들기</LinkButton>}
        />
      ) : grouped ? (
        // 태그마다 접었다 펴는 묶음. 태그가 여러 개인 페이지는 각 묶음에 나온다
        <div className="space-y-3">
          {[...allTags, ""].map((t) => {
            const rows = data.filter((p) => (t ? p.tags.includes(t) : p.tags.length === 0));
            if (rows.length === 0) return null;
            return (
              <details key={t || "none"} open className="group">
                <summary className={`cursor-pointer list-none py-1 font-semibold ${FOCUS_RING}`}>
                  <span aria-hidden="true" className="mr-1 inline-block transition-transform group-open:rotate-90">
                    ›
                  </span>
                  {t ? `#${t}` : "태그 없음"}{" "}
                  <span className="text-sm font-normal text-zinc-600 dark:text-zinc-400">({rows.length})</span>
                </summary>
                <div className="mt-2">{list(rows)}</div>
              </details>
            );
          })}
        </div>
      ) : (
        list(data)
      )}
    </div>
  );
}
