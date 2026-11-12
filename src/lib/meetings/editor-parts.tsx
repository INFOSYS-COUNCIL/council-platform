"use client";

import { filterSuggestionItems, insertOrUpdateBlockForSlashMenu } from "@blocknote/core/extensions";
import { ko } from "@blocknote/core/locales";
import { getDefaultReactSlashMenuItems, SuggestionMenuController } from "@blocknote/react";
import type { BlockNoteEditor } from "@blocknote/core";
import type { meetingSchema } from "./schema";

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
// onNewPage: "/페이지"를 고르면 새 페이지를 만들고 그 id를 돌려준다(실패하면 null). 편집기가 그 자리에 링크를 넣는다
export function MeetingSlashMenu({
  editor,
  onNewPage,
}: {
  editor: MeetingEditorInstance;
  onNewPage?: (title: string) => Promise<string | null>;
}) {
  return (
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
              onItemClick: () => {
                const url = window.prompt("링크 주소 (https://…)")?.trim();
                if (url && /^https?:\/\/\S+$/.test(url)) {
                  editor.insertInlineContent([{ type: "link", href: url, content: url }]);
                }
              },
            },
            ...(onNewPage
              ? [
                  {
                    title: "페이지",
                    subtext: "새 페이지를 만들고 여기에 링크 넣기",
                    aliases: ["페이지", "page", "문서"],
                    group: "기본 블록",
                    icon: <span aria-hidden="true">📄</span>,
                    onItemClick: async () => {
                      const title = window.prompt("새 페이지 제목", "새 페이지")?.trim();
                      if (!title) return;
                      const id = await onNewPage(title);
                      if (id) editor.insertInlineContent([{ type: "link", href: `/pages/${id}`, content: `📄 ${title}` }, " "]);
                    },
                  },
                ]
              : []),
          ],
          query,
        )
      }
    />
  );
}

// D-7: 파일·이미지 붙여넣기를 막는다. 막았으면 true
// 붙여 넣는 글이 마크다운이면 마크다운으로 읽는다(다른 편집기에서 복사한 HTML보다 우선).
export const MARKDOWN_PASTE = { prioritizeMarkdownOverHTML: true, plainTextAsMarkdown: true } as const;

export function blocksFilePaste(event: ClipboardEvent): boolean {
  return (event.clipboardData?.files.length ?? 0) > 0;
}
