import * as Y from "yjs";

// 회의록 편집자별 수정량(4차 사용 피드백): 저장된 Yjs Update마다 누가 보냈는지(actor_id) 알고 있으므로,
// Update를 풀어 새로 넣은 글자 수와 지운(고친) 글자 수를 사람별로 더한다.
// shortcut: 지운 수는 Yjs 삭제 범위 길이라 글자 외에 블록 경계·서식 표시도 조금 섞인다. 순서를 정하는 용도로는 충분하다.
export type EditStat = { added: number; changed: number };

export function editStats(updates: { actor: string; update: Uint8Array }[]): Map<string, EditStat> {
  const stats = new Map<string, EditStat>();
  for (const { actor, update } of updates) {
    const { structs, ds } = Y.decodeUpdate(update);
    let added = 0;
    for (const s of structs) {
      if (s instanceof Y.Item && s.content instanceof Y.ContentString) added += s.content.getLength();
    }
    let changed = 0;
    for (const ranges of ds.clients.values()) for (const r of ranges) changed += r.len;
    const prev = stats.get(actor) ?? { added: 0, changed: 0 };
    stats.set(actor, { added: prev.added + added, changed: prev.changed + changed });
  }
  return stats;
}

// 많이 고친 사람이 위로: 넣은 글자 + 고친 글자 합으로 정렬, 같으면 원래 순서
export function byEditAmount<T>(ids: T[], stats: Map<T, EditStat>): T[] {
  const total = (id: T) => (stats.get(id)?.added ?? 0) + (stats.get(id)?.changed ?? 0);
  return ids.map((id, i) => ({ id, i })).sort((a, b) => total(b.id) - total(a.id) || a.i - b.i).map((x) => x.id);
}
