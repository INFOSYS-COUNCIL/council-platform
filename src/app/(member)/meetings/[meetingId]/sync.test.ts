import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { MeetingSync, type SaveResult, type SyncIo } from "./sync";

// DB 대신 쓰는 가짜 서버: client_update_id 중복 방지, 순번 발급, 순번 이후 읽기
function fakeServer() {
  const rows: { id: string; seq: number; update: Uint8Array }[] = [];
  let failNext = 0;
  let deny: string | null = null;
  const listeners: ((seq: number) => void)[] = [];
  const io = (): SyncIo => ({
    async save(id, update): Promise<SaveResult> {
      if (deny) return { ok: false, fatal: true, message: deny };
      if (failNext > 0) {
        failNext--;
        return { ok: false, fatal: false, message: "network" };
      }
      if (!rows.some((r) => r.id === id)) {
        rows.push({ id, seq: rows.length + 1, update });
        listeners.forEach((l) => l(rows.length));
      }
      return { ok: true };
    },
    async fetchAfter(seq) {
      return rows.filter((r) => r.seq > seq).map(({ seq, update }) => ({ seq, update }));
    },
  });
  return {
    rows,
    io,
    onBroadcast: (l: (seq: number) => void) => listeners.push(l),
    failTimes: (n: number) => (failNext = n),
    denyAll: (message: string) => (deny = message),
  };
}

const started = (s: MeetingSync) => (s.start(), s);
const text = (doc: Y.Doc) => doc.getText("t").toString();
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("MeetingSync", () => {
  it("두 사람이 동시에 고쳐도 저장 후 같은 내용이 된다", async () => {
    const server = fakeServer();
    const a = new Y.Doc();
    const b = new Y.Doc();
    const syncA = started(new MeetingSync(a, 0, server.io(), undefined, 1));
    const syncB = started(new MeetingSync(b, 0, server.io(), undefined, 1));
    server.onBroadcast((seq) => {
      syncA.signal(seq);
      syncB.signal(seq);
    });

    a.getText("t").insert(0, "가나");
    b.getText("t").insert(0, "다라");
    await Promise.all([syncA.flushNow(), syncB.flushNow()]);
    await Promise.all([syncA.pull(), syncB.pull()]);

    expect(text(a)).toBe(text(b));
    expect(text(a)).toHaveLength(4);
    expect(server.rows.map((r) => r.seq)).toEqual([1, 2]);
  });

  it("여러 입력은 한 묶음으로 저장되고, 저장된 내용으로 새로 접속하면 복원된다", async () => {
    const server = fakeServer();
    const a = new Y.Doc();
    const sync = started(new MeetingSync(a, 0, server.io(), undefined, 1));
    a.getText("t").insert(0, "안");
    a.getText("t").insert(1, "녕");
    expect(sync.status.unsaved).toBe(2);
    await sync.flushNow();
    expect(server.rows).toHaveLength(1);
    expect(sync.status.unsaved).toBe(0);

    const fresh = new Y.Doc();
    const reload = started(new MeetingSync(fresh, 0, server.io()));
    await reload.pull();
    expect(text(fresh)).toBe("안녕");
    expect(reload.lastSeq).toBe(1);
  });

  it("저장이 실패하면 같은 묶음을 다시 보내고, 중복 저장되지 않는다", async () => {
    const server = fakeServer();
    server.failTimes(1);
    const a = new Y.Doc();
    const sync = started(new MeetingSync(a, 0, server.io(), undefined, 1));
    a.getText("t").insert(0, "x");
    await sync.flushNow();
    expect(sync.status.retrying).toBe(true);
    expect(sync.status.unsaved).toBe(1);
    await new Promise((r) => setTimeout(r, 1100));
    expect(server.rows).toHaveLength(1);
    expect(sync.status).toEqual({ unsaved: 0, retrying: false, stopped: null });
  });

  it("권한이 거부되면 다시 보내지 않고 멈추며 미저장 수를 남긴다", async () => {
    const server = fakeServer();
    server.denyAll("이 회의록을 편집할 권한이 없습니다.");
    const a = new Y.Doc();
    const sync = started(new MeetingSync(a, 0, server.io(), undefined, 1));
    a.getText("t").insert(0, "x");
    await sync.flushNow();
    expect(sync.status.stopped).toBe("이 회의록을 편집할 권한이 없습니다.");
    expect(sync.status.unsaved).toBe(1);
    a.getText("t").insert(0, "y");
    await tick();
    expect(server.rows).toHaveLength(0);
  });

  it("이미 반영한 순번 신호는 무시하고, 빠진 순번은 DB에서 채운다", async () => {
    const server = fakeServer();
    const writer = new Y.Doc();
    const writerSync = started(new MeetingSync(writer, 0, server.io(), undefined, 1));
    writer.getText("t").insert(0, "a");
    await writerSync.flushNow();
    writer.getText("t").insert(1, "b");
    await writerSync.flushNow();

    const reader = new Y.Doc();
    const readerSync = started(new MeetingSync(reader, 0, server.io()));
    readerSync.signal(2); // 1번 신호를 놓쳤어도 2번 신호에 1·2를 함께 읽는다
    await tick();
    await readerSync.pull();
    expect(text(reader)).toBe("ab");
    expect(readerSync.status.unsaved).toBe(0); // 받은 변경은 다시 저장하지 않는다
  });
});
