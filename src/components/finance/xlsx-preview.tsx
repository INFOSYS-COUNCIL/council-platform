"use client";

import { useEffect, useState } from "react";
import { saveFinanceWebVersion } from "@/app/(member)/finance/actions";
import { Button } from "@/components/ui/button";
import { fetchFinanceFile, uploadFinanceFile } from "@/lib/finance/files";

// .xlsx 읽기 전용 미리보기: 시트 탭 + 격자. 수식 칸은 업로드 당시 계산값을 회색으로 보여 준다(웹에서 다시 계산하지 않음).
// shortcut: 한 시트에 200행 × 26열까지만 그린다. 큰 장부가 생기면 가상 스크롤을 붙인다.
type Cell = { text: string; formula: boolean; bold: boolean; editable: boolean };
type Editor = { termId: string; docId: string; version: number; fileName: string };
type Sheet = { name: string; rows: Cell[][]; cols: number; truncated: boolean };
const MAX_ROWS = 200;
const MAX_COLS = 26;

export function XlsxPreview({ path, editor }: { path: string; editor?: Editor }) {
  const [originalFile, setOriginalFile] = useState<ArrayBuffer | null>(null);
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [sheets, setSheets] = useState<Sheet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [{ default: ExcelJS }, buf] = await Promise.all([import("exceljs"), fetchFinanceFile(path)]);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const out: Sheet[] = wb.worksheets.map((ws) => {
          const rowCount = Math.min(ws.rowCount, MAX_ROWS);
          const cols = Math.min(Math.max(ws.columnCount, 1), MAX_COLS);
          const rows: Cell[][] = [];
          for (let r = 1; r <= rowCount; r++) {
            const row = ws.getRow(r);
            const cells: Cell[] = [];
            for (let c = 1; c <= cols; c++) {
              const cell = row.getCell(c);
              const formula = cell.type === ExcelJS.ValueType.Formula;
              const editable = !cell.isMerged && !formula &&
                (cell.value === null || typeof cell.value === "string" || typeof cell.value === "number");
              cells.push({ text: cell.text ?? "", formula, bold: !!cell.font?.bold, editable });
            }
            rows.push(cells);
          }
          return { name: ws.name, rows, cols, truncated: ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS };
        });
        if (live) { setOriginalFile(buf); setSheets(out); }
      } catch (e) {
        if (live) setError((e as Error).message || "파일을 읽지 못했습니다.");
      }
    })();
    return () => {
      live = false;
    };
  }, [path]);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!sheets) return <p role="status" className="text-sm text-muted">양식을 불러오는 중…</p>;
  const sheet = sheets[active];
  const colName = (i: number) => String.fromCharCode(65 + i);

  async function saveDraft() {
    if (!editor || !originalFile) return;
    setSaving(true);
    setMessage("");
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(originalFile);
      for (const [key, value] of Object.entries(changes)) {
        const [sheetIndex, row, col] = key.split(":").map(Number);
        const cell = workbook.worksheets[sheetIndex].getRow(row).getCell(col);
        const original = sheets?.[sheetIndex].rows[row - 1][col - 1].text;
        if (value === original) continue;
        const number = Number(value);
        cell.value = value === "" ? null
          : /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value) && Number.isFinite(number) && value.replace(/[-.]/g, "").length <= 15
            ? number : value;
      }
      workbook.calcProperties.fullCalcOnLoad = true;
      const bytes = await workbook.xlsx.writeBuffer();
      const file = await uploadFinanceFile(editor.termId, new File([new Uint8Array(bytes)], editor.fileName));
      const result = await saveFinanceWebVersion({
        docId: editor.docId, filePath: file.path, fileName: file.name, expectedVersion: editor.version,
      });
      if (result.error) throw new Error(result.error);
      setSaved(true);
      setChanges({});
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "초안을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-2">
      <div role="tablist" aria-label="시트" className="flex flex-wrap gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {sheets.map((s, i) => (
          <button
            key={s.name}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`-mb-px rounded-t-lg px-3 py-2 text-sm ${i === active ? "border border-zinc-200 border-b-surface bg-surface font-semibold dark:border-zinc-800" : "text-muted"}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      {sheet && (
        <div className="max-h-[50vh] overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="border-collapse text-xs tabular-nums">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-10 bg-zinc-100 px-2 py-1 dark:bg-zinc-800" />
                {Array.from({ length: sheet.cols }, (_, i) => (
                  <th key={i} scope="col" className="sticky top-0 min-w-20 bg-zinc-100 px-2 py-1 font-semibold text-muted dark:bg-zinc-800">
                    {colName(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row, r) => (
                <tr key={r}>
                  <th scope="row" className="sticky left-0 bg-zinc-100 px-2 py-1 font-semibold text-muted dark:bg-zinc-800">
                    {r + 1}
                  </th>
                  {row.map((c, i) => (
                    <td
                      key={i}
                      title={c.formula ? "수식 칸(업로드 당시 값)" : undefined}
                      className={`max-w-56 truncate border border-zinc-200 px-2 py-1 dark:border-zinc-800 ${c.formula ? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" : ""} ${c.bold ? "font-semibold" : ""}`}
                    >
                      {editor && c.editable ? (
                        <input
                          aria-label={`${sheet.name} ${colName(i)}${r + 1}`}
                          className="w-24 min-w-0 bg-transparent px-1 py-1 focus-visible:outline-2 focus-visible:outline-accent"
                          value={changes[`${active}:${r + 1}:${i + 1}`] ?? c.text}
                          disabled={saving || saved}
                          onChange={(e) => {
                            const value = e.target.value;
                            setChanges((current) => ({ ...current, [`${active}:${r + 1}:${i + 1}`]: value }));
                          }}
                        />
                      ) : c.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        {editor ? "텍스트와 숫자 셀을 편집할 수 있습니다." : "읽기 전용 미리보기입니다."} 회색 수식 셀은 파일에 저장된 계산값을 보여 줍니다.
        {sheet?.truncated && ` 앞의 ${MAX_ROWS}행 × ${MAX_COLS}열까지만 보입니다.`}
      </p>
      {editor && (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" disabled={saving || saved || !Object.keys(changes).length} onClick={saveDraft}>
            {saving ? "저장 중…" : "초안 저장"}
          </Button>
          {message && <p role="alert" className="text-sm text-danger">{message}</p>}
          {saved && <p role="status" className="text-sm text-muted">새 버전을 저장했습니다.</p>}
        </div>
      )}
    </div>
  );
}
