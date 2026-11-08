import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { pageNumber, Pagination, PillLink } from "@/components/ui/pagination";
import { requireMember } from "@/lib/auth/session";
import { formatDateTime, todayInSeoul } from "@/lib/dates";
import {
  EVENT_CREATE_ROLES,
  EVENT_STATUS_LABELS,
  EVENT_STATUS_ORDER,
  EVENT_VISIBILITY_LABELS,
  type EventStatus,
} from "@/lib/events/labels";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "행사 | 학생회 운영 플랫폼",
};

const PER_PAGE = 20;

export default function EventsPage(props: PageProps<"/events">) {
  return (
    <Suspense fallback={<Skeleton />}>
      <EventsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function EventsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const membership = await requireMember("/events");
  const raw = await searchParams;
  const status: EventStatus = EVENT_STATUS_ORDER.find((s) => s === raw.status) ?? "ACTIVE";
  const page = pageNumber(raw.page);
  const href = (s: EventStatus, p = 1) => `/events?status=${s}${p > 1 ? `&page=${p}` : ""}`;

  // 볼 수 있는 행사만 RLS가 돌려준다. 지난 행사는 최근 것부터, 나머지는 가까운 날짜부터
  const supabase = await createClient();
  const from = (page - 1) * PER_PAGE;
  const { data: events, count, error } = await supabase
    .from("events")
    .select("id, name, starts_at, ends_at, visibility_mode, department:departments(name)", { count: "exact" })
    .eq("term_id", membership.termId)
    .eq("status", status)
    .order("starts_at", { ascending: status === "PLANNING" || status === "ACTIVE", nullsFirst: false })
    .order("created_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const canCreate = EVENT_CREATE_ROLES.includes(membership.role);
  const today = todayInSeoul();

  return (
    <div className="space-y-6">
      <PageHeader
        title="행사"
        actions={canCreate && <LinkButton href="/events/new">행사 만들기</LinkButton>}
      />
      <nav aria-label="행사 상태" className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        {(["ACTIVE", "PLANNING", "COMPLETED", "ARCHIVED"] as const).map((s) => (
          <PillLink key={s} href={href(s)} current={s === status}>
            {EVENT_STATUS_LABELS[s]}
          </PillLink>
        ))}
      </nav>

      {error ? (
        <Alert>
          불러오지 못했습니다.{" "}
          <Link href={href(status, page)} className="underline">
            다시 시도
          </Link>
        </Alert>
      ) : events.length === 0 ? (
        <EmptyState
          title="아직 행사가 없습니다."
          action={canCreate && status !== "ARCHIVED" ? <LinkButton href="/events/new">행사 만들기</LinkButton> : undefined}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                href={`/events/${event.id}`}
                className={`block h-full rounded-lg border border-zinc-200 bg-white p-4 hover:border-coral-500 dark:border-zinc-800 dark:bg-zinc-900 ${FOCUS_RING}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{event.name}</span>
                  {event.visibility_mode === "RESTRICTED" && (
                    <Badge tone="muted">{EVENT_VISIBILITY_LABELS.RESTRICTED.label}</Badge>
                  )}
                </span>
                <span className="mt-1 block text-sm text-zinc-600 dark:text-zinc-400">
                  {event.department?.name}
                  {event.starts_at && ` · ${formatDateTime(event.starts_at, today)}`}
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
