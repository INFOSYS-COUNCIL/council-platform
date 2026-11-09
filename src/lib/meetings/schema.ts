import { BlockNoteSchema, createBlockSpec, defaultBlockSpecs } from "@blocknote/core";

// 회의록·Template 편집기가 함께 쓰는 BlockNote 구조 (기획서 6.1절).
// React 없이 만들어 서버(Template → 초기 Snapshot 변환)에서도 같은 구조를 쓴다.

// D-7: 이미지·동영상·오디오·파일 블록을 넣지 않는다. 구조에서 빼면 Slash 메뉴와
// 붙여넣기·끌어넣기에서도 만들어지지 않는다.
const blockSpecs = Object.fromEntries(
  Object.entries(defaultBlockSpecs).filter(([type]) => !["image", "video", "audio", "file"].includes(type)),
) as Omit<typeof defaultBlockSpecs, "image" | "video" | "audio" | "file">;

// Callout은 BlockNote 기본 Block이 아니므로 직접 만든다. 종류는 Issue에서 정할 값이라 우선 하나만 둔다.
const createCallout = createBlockSpec(
  { type: "callout", propSchema: {}, content: "inline" },
  {
    render: () => {
      const dom = document.createElement("div");
      dom.className = "flex w-full gap-2 rounded-md bg-coral-50 p-3 dark:bg-zinc-800";
      const icon = document.createElement("span");
      icon.textContent = "💡";
      icon.setAttribute("aria-hidden", "true");
      icon.contentEditable = "false";
      const contentDOM = document.createElement("div");
      contentDOM.className = "flex-1";
      dom.append(icon, contentDOM);
      return { dom, contentDOM };
    },
  },
);

export const meetingSchema = BlockNoteSchema.create({
  blockSpecs: { ...blockSpecs, callout: createCallout() },
});

export type MeetingBlock = typeof meetingSchema.Block;
