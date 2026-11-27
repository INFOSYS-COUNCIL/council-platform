// JPEG 그림 여러 장을 한 페이지씩 담은 PDF를 만든다(패키지 없이). 페이지 크기는 그림 크기(96dpi 기준 pt)
export function buildPdf(pages: { jpeg: Uint8Array; width: number; height: number }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (d: string | Uint8Array) => {
    const bytes = typeof d === "string" ? enc.encode(d) : d;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (n: number, body: string) => {
    offsets[n] = length;
    push(`${n} 0 obj\n${body}\nendobj\n`);
  };

  push("%PDF-1.4\n");
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // 이진 파일 표시
  // 1: 카탈로그, 2: 페이지 목록, 페이지 i마다 3+3i: 페이지, 4+3i: 그리기 명령, 5+3i: 그림
  const kids = pages.map((_, i) => `${3 + 3 * i} 0 R`).join(" ");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`);
  pages.forEach((p, i) => {
    const w = +(p.width * 0.75).toFixed(2);
    const h = +(p.height * 0.75).toFixed(2);
    const [page, content, image] = [3 + 3 * i, 4 + 3 * i, 5 + 3 * i];
    object(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${image} 0 R >> >> /Contents ${content} 0 R >>`);
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(content, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    offsets[image] = length;
    push(`${image} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
    push(p.jpeg);
    push("\nendstream\nendobj\n");
  });

  const count = 3 + 3 * pages.length;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) push(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}
