import { isoToSeoulLocal } from "@/lib/dates";

// md로 저장할 때 파일 이름: "일시-제목.md" (일시는 한국 시간 "YYYY-MM-DD HHmm").
// 파일 이름에 쓸 수 없는 문자는 _로 바꾼다.
export function markdownFileName(iso: string, title: string): string {
  const when = isoToSeoulLocal(iso).replace("T", " ").replace(":", "");
  const safe = title.replace(/[\/:*?"<>|\u0000-\u001f]/g, "_").trim() || "제목 없음";
  return `${when}-${safe}.md`;
}
