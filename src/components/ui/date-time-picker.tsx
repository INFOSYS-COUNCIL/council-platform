"use client";

import { useId, useState } from "react";
import { formatDate, todayInSeoul } from "@/lib/dates";
import { addMonths, monthGrid } from "@/lib/schedules/week";

// 달력에서 날짜를 고르고 30분 단위 시각을 눌러 정하는 입력칸.
// 폼에는 <input type="datetime-local">과 같은 "YYYY-MM-DDTHH:mm"(한국 시간)으로 보낸다.
// withTime={false}면 날짜만 고르고 <input type="date">처럼 "YYYY-MM-DD"를 보낸다(비워 둘 수 있다).

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const TIMES = Array.from({ length: 29 }, (_, i) => {
  const minutes = 8 * 60 + i * 30; // 08:00 ~ 22:00
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const CELL =
  "grid h-9 place-items-center rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600";

export function DateTimePicker({
  label,
  name,
  defaultValue,
  required,
  hint,
  error,
  withTime = true,
}: {
  label: string;
  name: string;
  defaultValue: string;
  required?: boolean;
  hint?: string;
  error?: string;
  withTime?: boolean;
}) {
  const id = useId();
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16));
  const [month, setMonth] = useState(defaultValue.slice(0, 7) || todayInSeoul().slice(0, 7));
  const [open, setOpen] = useState(false);
  const days = monthGrid(month);
  const [year, monthNo] = month.split("-").map(Number);
  const value = !withTime ? date : date && time ? `${date}T${time}` : "";
  const times = TIMES.includes(time) || !time ? TIMES : [...TIMES, time].sort();

  return (
    <div className="space-y-1.5">
      <span id={`${id}-label`} className="block text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-xs font-normal text-red-700 dark:text-red-400">(필수)</span>}
      </span>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        aria-describedby={[hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-md border bg-white px-3 py-1.5 text-left text-base shadow-sm sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-zinc-900 ${
          error ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
        }`}
      >
        <span id={`${id}-value`}>{value ? `${formatDate(date)}${withTime ? ` ${time}` : ""}` : withTime ? "날짜와 시각을 고르세요" : "날짜를 고르세요"}</span>
        <span aria-hidden="true" className="text-zinc-500">▾</span>
      </button>
      {hint && <p id={`${id}-hint`} className="text-xs text-zinc-600 dark:text-zinc-400">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {open && (
        <div
          id={`${id}-panel`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="grid gap-4 rounded-xl border border-zinc-200 bg-surface p-3 shadow-lg dark:border-zinc-800"
        >
          <div>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label="지난달" onClick={() => setMonth(addMonths(month, -1))} className={`${CELL} w-9 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
                ←
              </button>
              <span className="text-sm font-semibold" aria-live="polite">{year}년 {monthNo}월</span>
              <button type="button" aria-label="다음 달" onClick={() => setMonth(addMonths(month, 1))} className={`${CELL} w-9 hover:bg-zinc-100 dark:hover:bg-zinc-800`}>
                →
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-zinc-600 dark:text-zinc-400" aria-hidden="true">
              {WEEKDAYS.map((w) => <span key={w} className="py-1">{w}</span>)}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {days.map((day) => {
                const selected = day === date;
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={selected}
                    aria-label={formatDate(day)}
                    onClick={() => {
                      setDate(day);
                      if (!withTime) setOpen(false);
                    }}
                    className={`${CELL} ${day.startsWith(month) ? "" : "text-zinc-400 dark:text-zinc-600"} ${
                      selected
                        ? "bg-coral-700 font-semibold text-white dark:bg-coral-400 dark:text-zinc-950"
                        : "hover:bg-coral-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>
          {withTime ? (
          <div>
            <p className="mb-2 text-sm font-semibold">시각</p>
            <div role="group" aria-label="시각" className="grid max-h-40 grid-cols-4 gap-1 overflow-y-auto">
              {times.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={t === time}
                  onClick={() => setTime(t)}
                  className={`${CELL} ${t === time ? "bg-coral-700 font-semibold text-white dark:bg-coral-400 dark:text-zinc-950" : "border border-zinc-200 hover:bg-coral-50 dark:border-zinc-800 dark:hover:bg-zinc-800"}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 w-full rounded-md bg-coral-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-coral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-coral-400 dark:text-zinc-950"
            >
              확인
            </button>
          </div>
          ) : (
            !required && date && (
              <button
                type="button"
                onClick={() => {
                  setDate("");
                  setOpen(false);
                }}
                className="justify-self-start rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                날짜 지우기
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
