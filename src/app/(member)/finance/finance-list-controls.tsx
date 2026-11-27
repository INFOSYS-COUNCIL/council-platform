"use client";

import Form from "next/form";
import Link from "next/link";
import { useState } from "react";
import { FOCUS_RING } from "@/components/ui/link-button";
import { FINANCE_EVENTS } from "@/lib/finance/labels";

const control = `h-11 rounded-lg border border-border-input bg-surface px-3 text-sm ${FOCUS_RING}`;

export function WorkFilters({ status, q, sort, event }: {
  status: string | null;
  q: string;
  sort: string;
  event: string;
}) {
  return (
    <Form action="/finance" onChange={(e) => e.currentTarget.requestSubmit()} className="flex flex-wrap gap-2">
      {status && <input type="hidden" name="status" value={status} />}
      {q && <input type="hidden" name="q" value={q} />}
      <select name="sort" aria-label="날짜순" defaultValue={sort} className={control}>
        <option value="date">최신순</option>
        <option value="old">오래된순</option>
      </select>
      <select name="event" aria-label="행사" defaultValue={event} className={control}>
        <option value="">전체 행사</option>
        {FINANCE_EVENTS.map((name) => <option key={name}>{name}</option>)}
      </select>
    </Form>
  );
}

export function ReferenceList({ documents }: {
  documents: { id: string; title: string; sensitive: boolean; base_date: string }[];
}) {
  const [query, setQuery] = useState("");
  if (!documents.length) return <p className="text-sm text-muted">등록된 참고 자료가 없습니다.</p>;

  const search = query.trim().toLocaleLowerCase();
  const matches = documents.filter((document) => document.title.toLocaleLowerCase().includes(search));
  return (
    <div className="space-y-3">
      <input
        type="search"
        aria-label="참고 자료 제목 검색"
        placeholder="참고 자료 제목 검색"
        className={`w-full max-w-xs ${control}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 ? <p role="status" className="text-sm text-muted">검색어와 일치하는 참고 자료가 없습니다.</p> : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-surface dark:divide-zinc-800 dark:border-zinc-800">
          {matches.map((document) => (
            <li key={document.id}>
              <Link href={`/finance/docs/${document.id}`} className={`block rounded p-3 hover:bg-coral-50 dark:hover:bg-zinc-800 ${FOCUS_RING}`}>
                <span className="font-semibold">{document.title}</span>
                {document.sensitive && <span className="ml-2 text-xs text-muted">민감</span>}
                <span className="ml-2 text-sm text-muted">{document.base_date}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
