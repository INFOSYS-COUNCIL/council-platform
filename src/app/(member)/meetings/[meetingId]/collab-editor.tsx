"use client";

import "@blocknote/mantine/style.css";
import { CollaborationExtension } from "@blocknote/core/yjs";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { applyAwarenessUpdate, Awareness, encodeAwarenessUpdate, removeAwarenessStates } from "y-protocols/awareness";
import * as Y from "yjs";
import { Alert } from "@/components/ui/alert";
import { rpcErrorMessage } from "@/lib/actions/result";
import { blocksFilePaste, MARKDOWN_PASTE, MEETING_DICTIONARY, MeetingSlashMenu } from "@/lib/meetings/editor-parts";
import { fromBytea, MEETING_FRAGMENT, toBytea } from "@/lib/meetings/labels";
import { meetingSchema } from "@/lib/meetings/schema";
import { createClient } from "@/lib/supabase/client";
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
}: {
  meetingId: string;
  initialState: string;
  initialSeq: number;
  canEdit: boolean;
  user: { id: string; name: string };
}) {
  const router = useRouter();
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
      // D-7: 파일·이미지 붙여넣기는 받지 않는다.
      // 마크다운 글(# 제목, - 목록, **굵게**, 표 등)을 붙여 넣으면 형식이 그대로 살아 있는 블록이 된다.
      pasteHandler: ({ event, defaultPasteHandler }) => {
        if (blocksFilePaste(event)) {
          setNotice("회의록에는 파일·이미지를 넣을 수 없습니다. 행사 자료에 올리고 링크를 붙여 주세요.");
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
      { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
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
          const state = channel!.presenceState<{ name: string }>();
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p aria-live="polite" className="text-zinc-600 dark:text-zinc-400">
          접속 중 {online.length}명{online.length > 0 && `: ${online.join(", ")}`}
          {!connected && " · 연결 끊김, 다시 연결하는 중"}
        </p>
        <p role="status" className={status.stopped || status.retrying ? "font-medium text-red-700 dark:text-red-400" : "font-medium text-coral-800 dark:text-coral-300"}>
          {saveLabel}
        </p>
      </div>
      {status.stopped && (
        <Alert>
          {status.stopped} 저장하지 못한 변경 {status.unsaved}개가 있습니다. 필요한 내용은 복사해 두고 새로고침해 주세요.
        </Alert>
      )}
      {notice && <Alert tone="info">{notice}</Alert>}
      <div className="min-h-64 rounded-md border border-zinc-200 bg-white py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <BlockNoteView editor={editor} editable={editable} slashMenu={false}>
          <MeetingSlashMenu editor={editor} />
        </BlockNoteView>
      </div>
    </div>
  );
}
