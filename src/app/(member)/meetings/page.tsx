import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/ui/action-form";
import { Alert } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/detail";
import { EmptyState } from "@/components/ui/empty-state";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { TextField } from "@/components/ui/form-field";
import { FOCUS_RING, LinkButton } from "@/components/ui/link-button";
import { PageHeader } from "@/components/ui/page-header";
import { pageNumber, Pagination, PillLink } from "@/components/ui/pagination";
import { ManageMenu, type ManageItem } from "@/components/ui/manage-menu";
import { getCurrentUserId, requireMember } from "@/lib/auth/session";
import { formatDateTime, isoToSeoulLocal, todayInSeoul } from "@/lib/dates";
import {
  MEETING_CREATE_ROLES,
  MEETING_STATUS_LABELS,
  MEETING_STATUS_ORDER,
  type MeetingStatus,
} from "@/lib/meetings/labels";
import { createClient } from "@/lib/supabase/server";
import { changeMeetingStatus, deleteMeeting, updateMeeting } from "./actions";

export const metadata: Metadata = {
  title: "회의록",
};

const PER_PAGE = 20;

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
  const me = await getCurrentUserId();
  const raw = await searchParams;
  // 보관한 회의록은 "보관" 탭에서만 보인다(기획서 6.8절)
  const status: MeetingStatus = MEETING_STATUS_ORDER.find((s) => s === raw.status) ?? "DRAFT";
  const page = pageNumber(raw.page);
  // 정렬: 회의 날짜 최신순(기본) / 오래된순
  const sort: "desc" | "asc" = raw.sort === "asc" ? "asc" : "desc";
  const href = (s: MeetingStatus, p = 1, o = sort) =>
    `/meetings?status=${s}${o === "asc" ? "&sort=asc" : ""}${p > 1 ? `&page=${p}` : ""}`;

  // 볼 수 있는 회의록만 RLS가 돌려준다
  const supabase = await createClient();
  const from = (page - 1) * PER_PAGE;
  const query = supabase
    .from("meeting_minutes")
    .select("id, title, meeting_at, updated_at, created_by, author_id", { count: "exact" })
    .eq("term_id", membership.termId)
    .eq("kind", "MEETING")
    .eq("status", status);
  const { data: meetings, count, error } = await query
    .order("meeting_at", { ascending: sort === "asc" })
    .order("updated_at", { ascending: false })
    .range(from, from + PER_PAGE - 1);

  const canCreate = MEETING_CREATE_ROLES.includes(membership.role);
  const newHref = "/meetings/new";
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
        <nav aria-label="정렬" className="flex flex-wrap gap-2 text-sm">
          <PillLink href={href(status, 1, "desc")} current={sort === "desc"}>최신 날짜순</PillLink>
          <PillLink href={href(status, 1, "asc")} current={sort === "asc"}>오래된 날짜순</PillLink>
        </nav>
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
            <li key={m.id} className="flex items-center gap-1 pr-2">
              <Link href={`/meetings/${m.id}`} className={`flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2 p-4 hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                <span className="min-w-0">
                  <span className="block font-semibold">{m.title}</span>
                  <span className="block text-sm text-zinc-600 dark:text-zinc-400">
                    회의 {formatDateTime(m.meeting_at, today)}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                  수정 {formatDateTime(m.updated_at, today)}
                </span>
              </Link>
              <ManageMenu title="회의록 관리" subtitle={m.title} items={meetingItems(m, status, membership.role, me)} />
            </li>
          ))}
        </ul>
      )}

      <Pagination page={page} totalPages={Math.ceil((count ?? 0) / PER_PAGE)} hrefFor={(p) => href(status, p)} />
    </div>
  );
}

// 목록 ⋯ 관리: 상세 화면과 같은 권한 기준(DB 함수가 다시 검사한다). 수정·삭제는 국장과 회장단만.
// 관리(정보 수정·보관): 회장단 또는 만든 국장 / 보관 풀기: 회장단 또는 대표 작성자 국장
// 삭제: 상태와 관계없이 회장단 또는 만든 사람·대표 작성자인 국장
function meetingItems(
  m: { id: string; title: string; meeting_at: string; created_by: string; author_id: string },
  status: MeetingStatus,
  role: string,
  me: string | null,
): ManageItem[] {
  const isExecutive = role === "EXECUTIVE";
  const isDirector = role === "DIRECTOR";
  const canManage = isExecutive || (isDirector && m.created_by === me);
  const canHandleArchived = isExecutive || (isDirector && m.author_id === me);
  const canDelete = isExecutive || (isDirector && (m.created_by === me || m.author_id === me));
  const hidden = <input type="hidden" name="meeting_id" value={m.id} />;
  const items: ManageItem[] = [];

  if (status !== "ARCHIVED" && canManage) {
    items.push(
      {
        key: "edit",
        label: "수정",
        content: (
          <ActionForm action={updateMeeting} submitLabel="저장">
            {hidden}
            <TextField label="제목" name="title" required maxLength={100} defaultValue={m.title} />
            <DateTimePicker label="회의 일시" name="meeting_at" required defaultValue={isoToSeoulLocal(m.meeting_at)} hint="한국 시간" />
          </ActionForm>
        ),
      },
      {
        key: "archive",
        label: "보관하기",
        content: (
          <ActionForm action={changeMeetingStatus} submitLabel="보관하기">
            {hidden}
            <input type="hidden" name="status" value="ARCHIVED" />
            <p className="text-sm">보관하면 목록의 &quot;보관됨&quot;으로 옮겨지고 본문이 잠겨 읽기만 할 수 있습니다.</p>
          </ActionForm>
        ),
      },
    );
  }
  if (status === "ARCHIVED" && canHandleArchived) {
    items.push({
        key: "reopen",
        label: "보관 풀고 다시 편집하기",
        content: (
          <ActionForm action={changeMeetingStatus} submitLabel="다시 편집하기">
            {hidden}
            <input type="hidden" name="status" value="DRAFT" />
            <p className="text-sm">&quot;편집 중&quot;으로 돌아가 다시 고칠 수 있게 됩니다.</p>
          </ActionForm>
        ),
    });
  }
  if (canDelete) {
    items.push({
        key: "delete",
        label: "삭제",
        danger: true,
        content: (
          <ActionForm action={deleteMeeting} submitLabel="삭제">
            {hidden}
            <input type="hidden" name="status_tab" value={status} />
            <p className="text-sm">이 회의록을 본문까지 완전히 지웁니다. 되돌릴 수 없습니다.</p>
          </ActionForm>
        ),
    });
  }
  return items;
}
