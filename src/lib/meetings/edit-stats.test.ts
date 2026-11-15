import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { byEditAmount, editStats } from "./edit-stats";

// 한 문서에 두 사람이 차례로 쓴 Update를 만든다
function capture(doc: Y.Doc, change: () => void) {
  let out: Uint8Array = new Uint8Array();
  const on = (u: Uint8Array) => (out = u);
  doc.on("update", on);
  change();
  doc.off("update", on);
  return out;
}

describe("editStats", () => {
  it("사람별로 넣은 글자와 지운 글자를 더한다", () => {
    const doc = new Y.Doc();
    const text = doc.getText("t");
    const a = capture(doc, () => text.insert(0, "가나다라마"));
    const b1 = capture(doc, () => text.insert(5, "바사"));
    const b2 = capture(doc, () => text.delete(0, 3));
    const stats = editStats([
      { actor: "A", update: a },
      { actor: "B", update: b1 },
      { actor: "B", update: b2 },
    ]);
    expect(stats.get("A")).toEqual({ added: 5, changed: 0 });
    expect(stats.get("B")).toEqual({ added: 2, changed: 3 });
  });

  it("합이 큰 사람이 위로, 같으면 원래 순서", () => {
    const stats = new Map([
      ["A", { added: 200, changed: 0 }],
      ["B", { added: 200, changed: 50 }],
    ]);
    expect(byEditAmount(["A", "B", "C"], stats)).toEqual(["B", "A", "C"]);
  });
});
