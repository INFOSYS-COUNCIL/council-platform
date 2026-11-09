import * as Y from "yjs";

// 회의록 본문 동기화 (기획서 6.4·6.5절). 화면과 Supabase 연결은 io로 넘겨받아 테스트할 수 있게 한다.
// - 내 변경: 짧은 간격으로 모아 Y.mergeUpdates로 합치고, 한 번에 한 묶음만 저장한다. 실패하면 같은
//   client_update_id로 다시 보낸다(DB가 중복 저장하지 않는다). 권한·상태 거부면 멈춘다.
// - 남의 변경: Broadcast는 "새 순번 있음" 신호로만 쓰고 본문은 DB에서 순번 순서로 읽는다.
// shortcut: 미저장 묶음은 메모리에만 둔다(창을 닫으면 사라지며, 닫기 전에 경고한다).
//   새로고침 뒤에도 살려야 하면 IndexedDB 보관을 추가한다(6.5절 "IndexedDB 권장").

export const REMOTE = "remote";
export const PULL_PAGE = 500;

export type SaveResult = { ok: true } | { ok: false; fatal: boolean; message: string };

export type SyncIo = {
  save(clientUpdateId: string, update: Uint8Array): Promise<SaveResult>;
  // seq보다 큰 순번을 오름차순으로 최대 PULL_PAGE개
  fetchAfter(seq: number): Promise<{ seq: number; update: Uint8Array }[]>;
};

export type SyncStatus = {
  unsaved: number; // 저장 확인을 받지 못한 변경 묶음 수(전송 중 포함)
  retrying: boolean;
  stopped: string | null; // 저장을 멈춘 이유(권한 회수·확정 등)
};

export class MeetingSync {
  private pending: Uint8Array[] = [];
  private inFlight: { id: string; update: Uint8Array; count: number } | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 1000;
  private retrying = false;
  private stopped: string | null = null;
  private pulling = false;
  private pullAgain = false;
  private disposed = true;

  constructor(
    private doc: Y.Doc,
    public lastSeq: number,
    private io: SyncIo,
    private onStatus: (status: SyncStatus) => void = () => {},
    private batchMs = 300,
  ) {}

  // 내 변경 감지를 시작하고, 멈추는 함수를 돌려준다(React effect에서 다시 시작할 수 있다)
  start() {
    this.disposed = false;
    this.doc.on("update", this.onLocalUpdate);
    this.schedule();
    return () => {
      this.disposed = true;
      this.doc.off("update", this.onLocalUpdate);
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    };
  }

  get status(): SyncStatus {
    return {
      unsaved: this.pending.length + (this.inFlight?.count ?? 0),
      retrying: this.retrying,
      stopped: this.stopped,
    };
  }

  // Broadcast로 받은 순번. 이미 반영한 순번이면 무시한다.
  signal(seq: number) {
    if (seq > this.lastSeq) void this.pull();
  }

  // lastSeq 뒤를 모두 읽어 반영한다. 동시에 여러 번 불려도 한 번에 하나만 돈다.
  async pull() {
    if (this.pulling) {
      this.pullAgain = true;
      return;
    }
    this.pulling = true;
    try {
      let rows;
      do {
        this.pullAgain = false;
        rows = await this.io.fetchAfter(this.lastSeq);
        for (const row of rows) {
          if (row.seq <= this.lastSeq) continue;
          Y.applyUpdate(this.doc, row.update, REMOTE);
          this.lastSeq = row.seq;
        }
      } while (rows.length === PULL_PAGE || this.pullAgain);
    } catch {
      // 연결 문제. 다음 신호나 재접속 때 다시 읽는다
    } finally {
      this.pulling = false;
    }
  }

  // 남은 묶음을 바로 보낸다(테스트·창 닫기 직전)
  flushNow() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return this.flush();
  }

  private onLocalUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE || this.disposed) return;
    this.pending.push(update);
    this.emit();
    this.schedule();
  };

  private schedule() {
    if (this.timer || this.inFlight || this.stopped || this.pending.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.batchMs);
  }

  private async flush() {
    if (this.inFlight || this.stopped || this.pending.length === 0) return;
    this.inFlight = { id: crypto.randomUUID(), update: Y.mergeUpdates(this.pending), count: this.pending.length };
    this.pending = [];
    await this.send();
  }

  private async send() {
    if (!this.inFlight) return;
    const result = await this.io.save(this.inFlight.id, this.inFlight.update).catch(
      (): SaveResult => ({ ok: false, fatal: false, message: "연결이 끊겼습니다." }),
    );
    if (result.ok) {
      this.inFlight = null;
      this.retryDelay = 1000;
      this.retrying = false;
      this.emit();
      this.schedule();
      void this.pull();
      return;
    }
    if (result.fatal) {
      this.stopped = result.message;
      this.retrying = false;
      this.emit();
      return;
    }
    // 지수 백오프로 같은 묶음을 다시 보낸다
    this.retrying = true;
    this.emit();
    setTimeout(() => void this.send(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 30000);
  }

  private emit() {
    this.onStatus(this.status);
  }
}
