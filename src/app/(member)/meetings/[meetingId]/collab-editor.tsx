"use client";

import "@blocknote/mantine/style.css";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useColorScheme } from "@/components/ui/theme-picker";
import { rpcErrorMessage } from "@/lib/actions/result";
import { blocksFilePaste, MARKDOWN_PASTE, MEETING_DICTIONARY, MEETING_IMAGE_MAX_BYTES, MEETING_IMAGE_TYPES, MeetingSlashMenu } from "@/lib/meetings/editor-parts";
import { fromBytea, MEETING_FRAGMENT, toBytea } from "@/lib/meetings/labels";
import { meetingSchema } from "@/lib/meetings/schema";
import { createClient } from "@/lib/supabase/client";
import { createPageFromEditor } from "../../pages/actions";
import { MeetingSync, PULL_PAGE, REMOTE, type SyncStatus } from "./sync";

// 회의록 공동편집기 (기획서 6.1·6.4·6.6절).
// 본문 Update는 save_meeting_update RPC로 저장하고, 채널 meeting:<id>(Private)에서 신호·커서·접속자를 받는다.

const CURSOR_COLORS = ["#c2410c", "#0f766e", "#7c3aed", "#be185d", "#1d4ed8", "#4d7c0f"];
const colorFor = (id: string) => CURSOR_COLORS[parseInt(id.slice(0, 2), 16) % CURSOR_COLORS.length];

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function CollabEditor({
  meetingId,
  initialState,
  initialSeq,
  canEdit,
  user,
  fileName,
}: {
  meetingId: string;
  initialState: string;
  initialSeq: number;
  canEdit: boolean;
  user: { id: string; name: string; };
  fileName: string; // md로 저장할 때 이름
}) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const supabase = useMemo(() => createClient(), []);
  // 서버가 합쳐 준 Snapshot + Update에서 시작한다. 이 적용은 저장 대상이 아니다.
  const [{ doc, awareness }] = useState(() => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, fromBytea(initialState), REMOTE);
    return { doc, awareness: new Awareness(doc) };
  });
  const [status, setStatus] = useState<SyncStatus>({ unsaved: 0, retrying: false, stopped: null });
  const [online, setOnline] = useState<string[]>([]);
  const [connected, setConnected] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const editable = canEdit && !status.stopped;

  const editor = useCreateBlockNote(
    {
      schema: meetingSchema,
      dictionary: MEETING_DICTIONARY,
      extensions: [
        CollaborationExtension({
          fragment: doc.getXmlFragment(MEETING_FRAGMENT),
          user: { name: user.name, color: colorFor(user.id) },
          provider: { awareness },
        }),
      ],
      // 공동 편집에서는 ProseMirror 기본 되돌리기(history)를 끄고 Yjs 되돌리기만 쓴다(BlockNote withCollaboration과 같음).
      // 둘이 함께 켜져 Ctrl/Cmd+Z가 기본 되돌리기로 가서, 안 되돌려지거나 엉뚱한 입력이 되돌려졌다(QA 3차)
      disableExtensions: ["history"],
      // 이미지(5MB 이하)는 붙여넣기·끌어넣기·"/이미지"로 넣는다(QA 3차). 다른 파일은 받지 않는다(D-7).
      // 올린 이미지는 /api/meeting-images/... 고정 주소로 본문에 들어가고, 볼 수 있는 사람만 연다.
      uploadFile: async (file: File) => {
        if (!MEETING_IMAGE_TYPES.includes(file.type)) throw new Error("PNG·JPG·WEBP·GIF 이미지만 넣을 수 있습니다.");
        if (file.size > MEETING_IMAGE_MAX_BYTES) throw new Error("이미지는 한 장에 5MB까지 넣을 수 있습니다.");
        const ext = file.type.split("/")[1].replace("jpeg", "jpg");
        const path = `${meetingId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("meeting-images").upload(path, file, { contentType: file.type });
        if (error) throw new Error("이미지를 올리지 못했습니다. 다시 시도해 주세요.");
        return `/api/meeting-images/${path}`;
      },
      // 마크다운 글(# 제목, - 목록, **굵게**, 표 등)을 붙여 넣으면 형식이 그대로 살아 있는 블록이 된다.
      pasteHandler: ({ event, defaultPasteHandler }) => {
        if (blocksFilePaste(event)) {
          setNotice("이미지(PNG·JPG·WEBP·GIF, 5MB 이하)만 넣을 수 있습니다. 다른 파일은 행사 자료에 올리고 링크를 붙여 주세요.");
          return true;
        }
        return defaultPasteHandler(MARKDOWN_PASTE);
      },
    },
    [],
  );

  const [sync] = useState(
    () =>
      new MeetingSync(doc, initialSeq, {
        async save(clientUpdateId, update) {
          const { error } = await supabase.rpc("save_meeting_update", {
            p_meeting_id: meetingId,
            p_client_update_id: clientUpdateId,
            p_update: toBytea(update),
          });
          if (!error) return { ok: true };
          // 권한 회수(42501)·확정·보관(55000)·잘못된 변경(22023)은 다시 보내도 같다
          const fatal = ["42501", "55000", "22023"].includes(error.code ?? "");
          return { ok: false, fatal, message: rpcErrorMessage(error) };
        },
        async fetchAfter(seq) {
          const { data, error } = await supabase
            .from("meeting_crdt_updates")
            .select("sequence_no, update_bytes")
            .eq("meeting_id", meetingId)
            .gt("sequence_no", seq)
            .order("sequence_no")
            .limit(PULL_PAGE);
          if (error) throw error;
          return data.map((r) => ({ seq: r.sequence_no, update: fromBytea(r.update_bytes) }));
        },
      }, setStatus),
  );

  useEffect(() => sync.start(), [sync]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (sync.status.unsaved > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [sync]);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    // 커서 정보(Awareness)는 Presence가 아니라 Broadcast로 보낸다(6.4절). 잦은 이동은 묶어 보낸다
    let changed = new Set<number>();
    let awarenessTimer: ReturnType<typeof setTimeout> | null = null;
    const sendAwareness = () => {
      awarenessTimer = null;
      if (!channel || changed.size === 0) return;
      const update = encodeAwarenessUpdate(awareness, [...changed]);
      changed = new Set();
      void channel.send({ type: "broadcast", event: "awareness", payload: { u: toBase64(update) } });
    };
    const onAwareness = (
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[]; },
      origin: unknown,
    ) => {
      if (origin === REMOTE || !canEdit) return;
      [...added, ...updated, ...removed].forEach((c) => changed.add(c));
      awarenessTimer ??= setTimeout(sendAwareness, 100);
    };
    awareness.on("update", onAwareness);

    (async () => {
      // Private 채널은 사용자 JWT로 권한을 확인한다(realtime.messages RLS)
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`meeting:${meetingId}`, { config: { private: true, presence: { key: user.id } } })
        .on("broadcast", { event: "crdt-update" }, ({ payload }) => sync.signal(Number(payload?.seq)))
        .on("broadcast", { event: "awareness" }, ({ payload }) => {
          if (typeof payload?.u === "string") applyAwarenessUpdate(awareness, fromBase64(payload.u), REMOTE);
        })
        .on("broadcast", { event: "status" }, () => router.refresh())
        .on("presence", { event: "sync" }, () => {
          const state = channel!.presenceState<{ name: string; }>();
          setOnline(Object.values(state).map((metas) => metas[0]?.name ?? "이름 없음"));
        })
        .subscribe((s) => {
          setConnected(s === "SUBSCRIBED");
          if (s === "SUBSCRIBED") {
            // 처음 접속·재접속 때 그 사이 저장된 변경을 채운다
            void sync.pull();
            void channel!.track({ name: user.name });
            awareness.getStates().forEach((_, c) => changed.add(c));
            sendAwareness();
          }
        });
    })();

    return () => {
      cancelled = true;
      awareness.off("update", onAwareness);
      removeAwarenessStates(awareness, [doc.clientID], "local");
      sendAwareness();
      if (awarenessTimer) clearTimeout(awarenessTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [awareness, canEdit, doc, meetingId, router, supabase, sync, user.id, user.name]);

  const saveLabel = !canEdit
    ? "읽기 전용"
    : status.stopped
      ? `저장 중단 · 미저장 ${status.unsaved}개`
      : status.retrying
        ? `저장 실패, 다시 시도 중 · 미저장 ${status.unsaved}개`
        : status.unsaved > 0
          ? `저장 중… · 미저장 ${status.unsaved}개`
          : "저장 완료";

  // "/페이지": 새 페이지(전체 공개)를 만들고 id를 돌려준다
  const newPage = async (title: string) => {
    const result = await createPageFromEditor(title);
    if ("error" in result) {
      setNotice(`페이지를 만들지 못했습니다. ${result.error}`);
      return null;
    }
    return result.id;
  };

  // 지금 화면의 본문을 Markdown 파일로 내려받는다(표·색 등 일부 서식은 빠질 수 있다)
  const saveMarkdown = () => {
    const url = URL.createObjectURL(new Blob([editor.blocksToMarkdownLossy(editor.document)], { type: "text/markdown;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
    a.click();
    URL.revokeObjectURL(url);
  };

  // PDF로 저장: 본문만 새 창에 깔끔하게 그려 브라우저 인쇄(“PDF로 저장”)를 연다. 서버에 파일을 만들지 않는다
  const savePdf = async () => {
    const win = window.open("", "_blank");
    if (!win) {
      setNotice("팝업이 막혀 PDF 창을 열지 못했습니다. 이 사이트의 팝업을 허용해 주세요.");
      return;
    }
    const title = fileName.replace(/\.md$/, "");
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
    const body = await editor.blocksToHTMLLossy(editor.document);
    win.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="${location.origin}/"><title>${esc(title)}</title>
<style>body{font-family:"Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif;color:#1f1a18;line-height:1.65;max-width:720px;margin:32px auto;padding:0 24px}
h1.doc-title{font-size:24px;border-bottom:2px solid #f45b4f;padding-bottom:8px}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}
blockquote{border-left:3px solid #ccc;margin-left:0;padding-left:12px;color:#555}pre{background:#f4f4f5;padding:8px;white-space:pre-wrap}@page{margin:16mm}</style>
</head><body><h1 class="doc-title">${esc(title)}</h1>${body}<script>window.addEventListener("load",function(){window.print()})</script></body></html>`);
    win.document.close();
  };

  // 되돌리기(Ctrl/Cmd+Z) 고침(QA 3차). 공동 편집은 Yjs UndoManager가 되돌리기를 맡는다.
  // 1) y-prosemirror는 편집기가 화면에서 떨어졌다 다시 붙을 때(개발 모드 이중 실행, 다시 그리기) UndoManager를 꺼 버리고
  //    다시 켜지 않는다. 그러면 기록이 쌓이지 않아 Ctrl/Cmd+Z가 아무것도 되돌리지 못했다. 입력 전에 꺼져 있으면 다시 켠다.
  // 2) 0.5초 안의 입력은 한 묶음이라 쉬지 않고 치면 긴 문장이 한 번에 되돌려졌다. 띄어쓰기·줄바꿈·문장부호·붙여넣기에서 끊는다.
  type UndoManagerLike = {
    doc: { on(event: "afterTransaction", fn: unknown): void };
    trackedOrigins: Set<unknown>;
    afterTransactionHandler: unknown;
    stopCapturing(): void;
  };
  const undoManager = () => {
    const state = editor.prosemirrorState;
    const plugin = state.plugins.find((p) => (p as unknown as { key: string }).key.startsWith("y-undo"));
    const um = (plugin?.getState(state) as { undoManager?: UndoManagerLike } | undefined)?.undoManager;
    // UndoManager는 만들 때 자기 자신을 trackedOrigins에 넣고, destroy()에서 뺀다. 빠져 있으면 꺼진 것이다
    if (um && !um.trackedOrigins.has(um)) {
      um.trackedOrigins.add(um);
      um.doc.on("afterTransaction", um.afterTransactionHandler);
    }
    return um;
  };
  const beforeInput = () => void undoManager();
  const onEditorKeyDown = (e: KeyboardEvent) => {
    const um = undoManager();
    if (["Space", "Enter", "NumpadEnter", "Period", "Comma", "Slash", "Semicolon"].includes(e.code) || e.key === " ") um?.stopCapturing();
  };
  const onEditorPaste = () => undoManager()?.stopCapturing();

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-surface dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p aria-live="polite" className="text-zinc-600 dark:text-zinc-400">
          접속 중 {online.length}명{online.length > 0 && `: ${online.join(", ")}`}
          {!connected && " · 연결 끊김, 다시 연결하는 중"}
        </p>
        <p role="status" className={status.stopped || status.retrying ? "font-medium text-red-700 dark:text-red-400" : "font-medium text-coral-800 dark:text-coral-300"}>
          {saveLabel}
        </p>
        <span className="flex gap-2">
          <Button type="button" variant="secondary" onClick={saveMarkdown}>md로 저장</Button>
          <Button type="button" variant="secondary" onClick={savePdf}>PDF로 저장</Button>
        </span>
      </div>
      {status.stopped && (
        <Alert>
          {status.stopped} 저장하지 못한 변경 {status.unsaved}개가 있습니다. 필요한 내용은 복사해 두고 새로고침해 주세요.
        </Alert>
      )}
      {notice && <Alert tone="info">{notice}</Alert>}
      <div className="min-h-64 bg-surface py-4" onKeyDownCapture={onEditorKeyDown} onPasteCapture={onEditorPaste} onDropCapture={beforeInput} onBeforeInputCapture={beforeInput}>
        <BlockNoteView editor={editor} theme={colorScheme} editable={editable} slashMenu={false}>
          <MeetingSlashMenu editor={editor} onNewPage={newPage} />
        </BlockNoteView>
      </div>
    </div>
  );
}
