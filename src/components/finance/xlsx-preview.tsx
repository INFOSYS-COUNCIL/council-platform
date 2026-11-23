"use client";

import { useEffect, useState } from "react";
import { fetchFinanceFile } from "@/lib/finance/files";

// .xlsx 읽기 전용 미리보기: 시트 탭 + 격자. 수식 칸은 업로드 당시 계산값을 회색으로 보여 준다(웹에서 다시 계산하지 않음).
// shortcut: 한 시트에 200행 × 26열까지만 그린다. 큰 장부가 생기면 가상 스크롤을 붙인다.
type Cell = { text: string; formula: boolean; bold: boolean };
type Sheet = { name: string; rows: Cell[][]; cols: number; truncated: boolean };
const MAX_ROWS = 200;
const MAX_COLS = 26;

export function XlsxPreview({ path }: { path: string }) {
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
              cells.push({ text: cell.text ?? "", formula: cell.type === ExcelJS.ValueType.Formula, bold: !!cell.font?.bold });
            }
            rows.push(cells);
          }
          return { name: ws.name, rows, cols, truncated: ws.rowCount > MAX_ROWS || ws.columnCount > MAX_COLS };
        });
        if (live) setSheets(out);
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
                      {c.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">
        읽기 전용 미리보기입니다. 회색 칸은 수식이며, 값은 파일을 올릴 당시 계산된 값입니다.
        {sheet?.truncated && ` 앞의 ${MAX_ROWS}행 × ${MAX_COLS}열까지만 보입니다.`}
      </p>
    </div>
  );
}
