import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";

describe("buildPdf", () => {
  it("페이지마다 그림 하나를 담고, xref 위치가 각 객체 시작을 가리킨다", async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x01, 0x02, 0xff, 0xd9]);
    const bytes = new Uint8Array(await buildPdf([{ jpeg, width: 1080, height: 1350 }, { jpeg, width: 1080, height: 1350 }]).arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Count 2");
    expect(text).toContain("/MediaBox [0 0 810 1012.5]");
    const xref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...text.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(8); // 카탈로그·페이지 목록 + 페이지마다 3개
    offsets.forEach((o, i) => expect(text.slice(o).startsWith(`${i + 1} 0 obj`)).toBe(true));
  });
});
