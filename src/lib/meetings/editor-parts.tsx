"use client";

import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { ko } from "@blocknote/core/locales";
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import type { meetingSchema } from "./schema";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// 회의록 편집기와 Template 편집기가 함께 쓰는 한국어 사전과 Slash 메뉴 (기획서 6.1절)

type MeetingEditorInstance = BlockNoteEditor<
  typeof meetingSchema.blockSchema,
  typeof meetingSchema.inlineContentSchema,
  typeof meetingSchema.styleSchema
>;

const withAliases = <T extends { aliases?: string[] }>(item: T, aliases: string[]) => ({
  ...item,
  aliases: [...(item.aliases ?? []), ...aliases],
});

// 기본 한국어 사전에 없는 별칭만 더한다
export const MEETING_DICTIONARY = {
  ...ko,
  slash_menu: {
    ...ko.slash_menu,
    quote: withAliases(ko.slash_menu.quote, ["인용", "quote"]),
    check_list: withAliases(ko.slash_menu.check_list, ["할일", "todo"]),
    code_block: withAliases(ko.slash_menu.code_block, ["코드"]),
    divider: withAliases(ko.slash_menu.divider, ["구분선"]),
    table: withAliases(ko.slash_menu.table, ["table"]),
  },
};

// BlockNoteView 안에 넣는다. BlockNoteView에는 slashMenu={false}를 준다.
// onNewPage: "/새 페이지"를 고르면 새 페이지를 만들고 그 id를 돌려준다(실패하면 null). 편집기가 그 자리에 바로가기를 넣는다.
// "/기존 페이지"는 볼 수 있는 페이지·회의록을 골라 바로가기를 넣는다. 링크·페이지 이름 입력은 브라우저 기본 창 대신 직접 만든 창을 쓴다.
type DialogKind = "link" | "newPage" | "pickPage" | null;

export function MeetingSlashMenu({
  editor,
  onNewPage,
}: {
  editor: MeetingEditorInstance;
  onNewPage?: (title: string) => Promise<string | null>;
}) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const close = () => {
    setDialog(null);
    editor.focus();
  };
  const insertPageLink = (pageId: string, title: string) => {
    editor.focus();
    editor.insertInlineContent([{ type: "pageLink", props: { pageId, title } }, " "]);
  };

  return (
    <>
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={async (query) =>
          filterSuggestionItems(
            [
              ...getDefaultReactSlashMenuItems(editor),
              {
                title: "콜아웃",
                subtext: "눈에 띄게 강조하는 상자",
                aliases: ["콜아웃", "강조", "callout"],
                group: "기본 블록",
                icon: <span aria-hidden="true">💡</span>,
                onItemClick: () => insertOrUpdateBlockForSlashMenu(editor, { type: "callout" }),
              },
              {
                title: "링크",
                subtext: "지금 위치에 링크 넣기",
                aliases: ["링크", "link", "url"],
                group: "기본 블록",
                icon: <span aria-hidden="true">🔗</span>,
                onItemClick: () => setDialog("link"),
              },
              {
                title: "기존 페이지",
                subtext: "이미 있는 페이지·회의록 바로가기 넣기",
                aliases: ["기존", "바로가기", "페이지 링크", "mention"],
                group: "기본 블록",
                icon: <span aria-hidden="true">📎</span>,
                onItemClick: () => setDialog("pickPage"),
              },
              ...(onNewPage
                ? [
                    {
                      title: "새 페이지",
                      subtext: "새 페이지를 만들고 여기에 바로가기 넣기",
                      aliases: ["페이지", "page", "문서"],
                      group: "기본 블록",
                      icon: <span aria-hidden="true">📄</span>,
                      onItemClick: () => setDialog("newPage"),
                    },
                  ]
                : []),
            ],
            query,
          )
        }
      />
      {dialog === "link" && (
        <EditorDialog title="링크 넣기" onClose={close}>
          <LinkForm
            onSubmit={(href, text) => {
              editor.focus();
              editor.insertInlineContent([{ type: "link", href, content: text || href }, " "]);
              setDialog(null);
            }}
            onCancel={close}
          />
        </EditorDialog>
      )}
      {dialog === "newPage" && onNewPage && (
        <EditorDialog title="새 페이지 만들기" onClose={close}>
          <NewPageForm
            onSubmit={async (title) => {
              const id = await onNewPage(title);
              if (id) insertPageLink(id, title);
              setDialog(null);
            }}
            onCancel={close}
          />
        </EditorDialog>
      )}
      {dialog === "pickPage" && (
        <EditorDialog title="기존 페이지 바로가기" onClose={close}>
          <PagePicker
            onPick={(id, title) => {
              insertPageLink(id, title);
              setDialog(null);
            }}
          />
        </EditorDialog>
      )}
    </>
  );
}

const INPUT =
  "h-11 w-full rounded-lg border border-border-input bg-surface px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-60";
const SECONDARY = "inline-flex min-h-11 items-center justify-center rounded-lg border border-border-input bg-surface px-4 text-sm font-semibold";

// 편집기 위에 뜨는 작은 창(Esc·바깥 누르기로 닫힘)
function EditorDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 dark:border-zinc-700"
    >
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="text-base font-bold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

const URL_PATTERN = /^https?:\/\/\S+\.\S+$/;

function LinkForm({ onSubmit, onCancel }: { onSubmit: (href: string, text: string) => void; onCancel: () => void }) {
  const [href, setHref] = useState("https://");
  const [text, setText] = useState("");
  const valid = URL_PATTERN.test(href.trim());
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onSubmit(href.trim(), text.trim());
      }}
    >
      <label className="block space-y-1 text-sm font-medium">
        <span>링크 주소</span>
        <input autoFocus className={INPUT} value={href} onChange={(e) => setHref(e.target.value)} inputMode="url" placeholder="https://" />
      </label>
      {!valid && href.length > 8 && <p className="text-sm text-danger">https:// 로 시작하는 주소를 넣어 주세요.</p>}
      <label className="block space-y-1 text-sm font-medium">
        <span>보이는 글자 (비우면 주소 그대로)</span>
        <input className={INPUT} value={text} onChange={(e) => setText(e.target.value)} maxLength={100} placeholder="예: 신청 구글폼" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onCancel}>
          취소
        </button>
        <button type="submit" className={PRIMARY} disabled={!valid}>
          넣기
        </button>
      </div>
    </form>
  );
}

function NewPageForm({ onSubmit, onCancel }: { onSubmit: (title: string) => Promise<void>; onCancel: () => void }) {
  const [title, setTitle] = useState("새 페이지");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!title.trim() || busy) return;
        setBusy(true);
        await onSubmit(title.trim().slice(0, 100));
      }}
    >
      <label className="block space-y-1 text-sm font-medium">
        <span>페이지 제목</span>
        <input autoFocus className={INPUT} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} onFocus={(e) => e.target.select()} />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={SECONDARY} onClick={onCancel}>
          취소
        </button>
        <button type="submit" className={PRIMARY} disabled={busy || !title.trim()}>
          {busy ? "만드는 중…" : "만들기"}
        </button>
      </div>
    </form>
  );
}

type PageRow = { id: string; title: string; kind: string };

// 볼 수 있는 페이지·회의록(RLS)을 최근 수정 순으로, 제목으로 찾는다
function PagePicker({ onPick }: { onPick: (id: string, title: string) => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<PageRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let stale = false;
    const t = setTimeout(async () => {
      const supabase = createClient();
      let query = supabase.from("meeting_minutes").select("id, title, kind").order("updated_at", { ascending: false }).limit(30);
      const term = q.trim();
      // 검색어의 %·_는 글자 그대로 찾는다
      if (term) query = query.ilike("title", `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
      const { data, error } = await query;
      if (stale) return;
      setFailed(!!error);
      setRows(data ?? []);
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);
  return (
    <div className="space-y-3">
      <input
        autoFocus
        type="search"
        className={INPUT}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="페이지·회의록 제목 검색"
        aria-label="페이지·회의록 제목 검색"
      />
      {failed ? (
        <p className="text-sm text-danger">불러오지 못했습니다. 다시 시도해 주세요.</p>
      ) : rows === null ? (
        <p role="status" className="text-sm text-muted">
          불러오는 중…
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">맞는 페이지가 없습니다.</p>
      ) : (
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onPick(r.id, r.title)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-accent dark:hover:bg-zinc-800"
              >
                <span aria-hidden="true">{r.kind === "MEETING" ? "🗒️" : "📄"}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
                <span className="shrink-0 text-xs text-muted">{r.kind === "MEETING" ? "회의록" : "페이지"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// D-7: 이미지가 아닌 파일 붙여넣기를 막는다. 막았으면 true(이미지는 편집기가 올린다)
// 붙여 넣는 글이 마크다운이면 마크다운으로 읽는다(다른 편집기에서 복사한 HTML보다 우선).
export const MARKDOWN_PASTE = { prioritizeMarkdownOverHTML: true, plainTextAsMarkdown: true } as const;

export function blocksFilePaste(event: ClipboardEvent): boolean {
  return [...(event.clipboardData?.files ?? [])].some((f) => !MEETING_IMAGE_TYPES.includes(f.type));
}

export const MEETING_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MEETING_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
