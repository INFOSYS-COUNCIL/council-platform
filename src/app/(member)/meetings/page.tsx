import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectField } from "@/components/ui/form-field";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { pageNumber, Pagination, PillLink } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { requireMember } from "@/lib/auth/session";
import { formatDateTime, todayInSeoul } from "@/lib/dates";
import {
  MEETING_CREATE_ROLES,
  MEETING_STATUS_LABELS,
  MEETING_STATUS_ORDER,
  type MeetingStatus,
} from "@/lib/meetings/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "회의록",
};

const PER_PAGE = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function MeetingsPage(props: PageProps<"/meetings">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <MeetingsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function MeetingsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireMember("/meetings");
  const raw = await searchParams;
  // 보관한 회의록은 "보관" 탭에서만 보인다(기획서 6.8절)
  const status: MeetingStatus = MEETING_STATUS_ORDER.find((s) => s === raw.status) ?? "DRAFT";
  const eventId = typeof raw.event === "string" && UUID.test(raw.event) ? raw.event : "";
  const page = pageNumber(raw.page);
  const href = (s: MeetingStatus, p = 1) =>
    `/meetings?status=${s}${eventId ? `&event=${eventId}` : ""}${p > 1 ? `&page=${p}` : ""}`;

  // 볼 수 있는 회의록만 RLS가 돌려준다. 최근 수정순
  const supabase = await createClient();
  const from = (page - 1) * PER_PAGE;
  let query = supabase
    .from("meeting_minutes")
    .select("id, title, meeting_at, updated_at, event:events(name)", { count: "exact" })
    .eq("term_id", membership.termId)
    .eq("status", status);
  if (eventId) query = query.eq("event_id", eventId);
  const [{ data: meetings, count, error }, { data: events }] = await Promise.all([
    query.order("updated_at", { ascending: false }).range(from, from + PER_PAGE - 1),
    supabase.from("events").select("id, name").eq("term_id", membership.termId).neq("status", "ARCHIVED").order("name"),
  ]);

  const canCreate = MEETING_CREATE_ROLES.includes(membership.role);
  const newHref = eventId ? `/meetings/new?event=${eventId}` : "/meetings/new";
  const today = todayInSeoul();

  return (
    <div className="space-y-6">
      <PageHeader title="회의록" actions={canCreate && <LinkButton href={newHref}>회의록 만들기</LinkButton>} />
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <nav aria-label="회의록 상태" className="flex flex-wrap gap-2">
          {MEETING_STATUS_ORDER.map((s) => (
            <PillLink key={s} href={href(s)} current={s === status}>
              {MEETING_STATUS_LABELS[s]}
            </PillLink>
          ))}
        </nav>
        {/* 행사 필터는 GET 폼이라 JavaScript 없이도 동작한다 */}
        <form action="/meetings" className="flex items-end gap-2">
          <input type="hidden" name="status" value={status} />
          <SelectField
            label="행사"
            name="event"
            defaultValue={eventId}
            placeholder="전체"
            options={(events ?? []).map((e) => ({ value: e.id, label: e.name }))}
          />
          <Button type="submit" variant="secondary">
            보기
          </Button>
        </form>
      </div>

      {error ? (
        <Alert>
          불러오지 못했습니다.{" "}
          <Link href={href(status, page)} className="underline">
            다시 시도
          </Link>
        </Alert>
      ) : meetings.length === 0 ? (
        <EmptyState
          title="회의록이 없습니다."
          action={canCreate && status === "DRAFT" ? <LinkButton href={newHref}>회의록 만들기</LinkButton> : undefined}
        />
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className={`flex flex-wrap items-center justify-between gap-2 p-4 hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                <span className="min-w-0">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    회의 {formatDateTime(m.meeting_at, today)}
                    {m.event && ` · ${m.event.name}`}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  수정 {formatDateTime(m.updated_at, today)}
                  {status === "CONFIRMED" && <Badge tone="strong">확정</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => href(status, p)} />
    </div>
  );
}
