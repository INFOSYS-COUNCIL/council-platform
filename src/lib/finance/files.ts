"use client";

import { createClient } from "@/lib/supabase/client";

// 재무 파일(.xlsx)은 비공개 저장소 finance-files의 "<term_id>/<uuid>.xlsx"에 둔다. 볼 수 있는지는 저장소 RLS가 정한다.
export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const XLSX_MAX_BYTES = 20 * 1024 * 1024;

export async function uploadFinanceFile(termId: string, file: File): Promise<{ path: string; name: string }> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error(".xlsx 파일만 올릴 수 있습니다(매크로가 든 .xlsm은 받지 않습니다).");
  if (file.size > XLSX_MAX_BYTES) throw new Error("파일은 20MB까지 올릴 수 있습니다.");
  const path = `${termId}/${crypto.randomUUID()}.xlsx`;
  // 브라우저가 형식을 비워 보내면 저장소가 거절하므로 형식을 붙여 보낸다
  const typed = new File([file], file.name, { type: XLSX_TYPE });
  const { error } = await createClient().storage.from("finance-files").upload(path, typed, { contentType: XLSX_TYPE });
  if (error) throw new Error("파일을 올리지 못했습니다. 다시 시도해 주세요.");
  return { path, name: file.name };
}

export async function fetchFinanceFile(path: string): Promise<ArrayBuffer> {
  const { data, error } = await createClient().storage.from("finance-files").download(path);
  if (error || !data) throw new Error("파일을 불러오지 못했습니다. 볼 수 있는 권한이 있는지 확인해 주세요.");
  return data.arrayBuffer();
}

export async function downloadFinanceFile(path: string, fileName: string) {
  const buf = await fetchFinanceFile(path);
  const url = URL.createObjectURL(new Blob([buf], { type: XLSX_TYPE }));
  const a = Object.assign(document.createElement("a"), { href: url, download: fileName });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
