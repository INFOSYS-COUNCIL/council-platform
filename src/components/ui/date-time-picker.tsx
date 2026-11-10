"use client";

import { useId, useState } from "react";
import { formatDate, todayInSeoul } from "@/lib/dates";
import { addMonths, monthGrid } from "@/lib/schedules/week";

// 사이트 디자인에 맞춘 달력 입력칸. 날짜를 누르고, 시간이 필요하면 30분 단위 시각을 누른다.
// 폼에는 기본 입력칸과 같은 값을 보낸다:
//   withTime(기본) → "YYYY-MM-DDTHH:mm"(한국 시간, datetime-local과 같음)
//   withTime={false} → "YYYY-MM-DD"(date와 같음)
// min을 주면 그보다 앞선 날짜·시각은 고를 수 없다(종료를 시작보다 늦게 고정할 때).
// value·onChange를 주면 부모가 값을 쥔다(시작·종료를 함께 맞출 때). 안 주면 스스로 값을 쥔다.

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const TIMES = Array.from({ length: 36 }, (_, i) => {
  const minutes = 6 * 60 + i * 30; // 06:00 ~ 23:30
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const CELL =
  "grid h-9 place-items-center rounded-md text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-30";
const SELECTED = "bg-coral-700 font-semibold text-white dark:bg-coral-400 dark:text-zinc-950";

// "13:30" → "오후 1:30"
export function timeLabelKo(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h < 12 ? "오전" : "오후"} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")}`;
}

export function DateTimePicker({
  label,
  name,
  defaultValue = "",
  value: controlled,
  onChange,
  min,
  required,
  hint,
  error,
  withTime = true,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  withTime?: boolean;
}) {
  const id = useId();
  const [own, setOwn] = useState(defaultValue);
  const value = controlled ?? own;
  const setValue = (next: string) => {
    if (controlled === undefined) setOwn(next);
    onChange?.(next);
  };
  const date = value.slice(0, 10);
  const time = value.slice(11, 16);
  const [month, setMonth] = useState((value || min || todayInSeoul()).slice(0, 7));
  const [open, setOpen] = useState(false);
  const days = monthGrid(month);
  const [year, monthNo] = month.split("-").map(Number);
  const minDate = min?.slice(0, 10) ?? "";
  const minTime = date && date === minDate ? (min?.slice(11, 16) ?? "") : "";
  const times = TIMES.includes(time) || !time ? TIMES : [...TIMES, time].sort();
  const today = todayInSeoul();

  const pickDate = (day: string) => {
    if (!withTime) {
      setValue(day);
      setOpen(false);
      return;
    }
    // 같은 날 최소 시각보다 이르면 최소 시각으로 맞춘다. 시각이 없으면 오전 10시로 둔다.
    const sameDayMin = day === minDate ? (min?.slice(11, 16) ?? "") : "";
    let t = time || "10:00";
    if (sameDayMin && t < sameDayMin) t = TIMES.find((x) => x >= sameDayMin) ?? sameDayMin;
    setValue(`${day}T${t}`);
  };

  const display = !value
    ? withTime ? "날짜와 시각을 고르세요" : "날짜를 고르세요"
    : withTime && time
      ? `${formatDate(date)} ${timeLabelKo(time)}`
      : formatDate(date);

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
        } ${value ? "" : "text-zinc-500 dark:text-zinc-400"}`}
      >
        <span id={`${id}-value`}>{display}</span>
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-coral-700 dark:text-coral-300" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="2.5" y="3.5" width="11" height="10" rx="1.5" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </svg>
      </button>
      {hint && <p id={`${id}-hint`} className="text-xs text-zinc-600 dark:text-zinc-400">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {open && (
        <div
          id={`${id}-panel`}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          className="grid gap-4 rounded-xl border border-coral-200 bg-surface p-3 shadow-lg shadow-coral-900/5 dark:border-zinc-800"
        >
          <div>
            <div className="mb-2 flex items-center justify-between">
              <button type="button" aria-label="지난달" onClick={() => setMonth(addMonths(month, -1))} className={`${CELL} w-9 hover:bg-coral-50 dark:hover:bg-zinc-800`}>
                ←
              </button>
              <span className="text-sm font-semibold" aria-live="polite">{year}년 {monthNo}월</span>
              <button type="button" aria-label="다음 달" onClick={() => setMonth(addMonths(month, 1))} className={`${CELL} w-9 hover:bg-coral-50 dark:hover:bg-zinc-800`}>
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
                    disabled={Boolean(minDate) && day < minDate}
                    aria-pressed={selected}
                    aria-label={formatDate(day)}
                    onClick={() => pickDate(day)}
                    className={`${CELL} ${day.startsWith(month) ? "" : "text-zinc-400 dark:text-zinc-600"} ${
                      selected
                        ? SELECTED
                        : `hover:bg-coral-50 dark:hover:bg-zinc-800 ${day === today ? "ring-1 ring-coral-300 dark:ring-coral-800" : ""}`
                    }`}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          </div>

          {withTime && (
            <div>
              <p className="mb-2 text-sm font-semibold">
                시각 {!date && <span className="font-normal text-zinc-600 dark:text-zinc-400">(먼저 날짜를 고르세요)</span>}
              </p>
              <div role="group" aria-label="시각" className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto sm:grid-cols-4">
                {times.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={!date || (Boolean(minTime) && t < minTime)}
                    aria-pressed={t === time}
                    onClick={() => setValue(`${date}T${t}`)}
                    className={`${CELL} ${t === time ? SELECTED : "border border-zinc-200 hover:bg-coral-50 dark:border-zinc-800 dark:hover:bg-zinc-800"}`}
                  >
                    {timeLabelKo(t)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            {!required && value ? (
              <button
                type="button"
                onClick={() => {
                  setValue("");
                  setOpen(false);
                }}
                className="rounded-md px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                지우기
              </button>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md bg-coral-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-coral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:bg-coral-400 dark:text-zinc-950"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// 시작·종료를 함께 고르는 두 칸. 종료는 시작보다 앞설 수 없고, 시작을 종료 뒤로 옮기면 종료도 따라 옮긴다.
export function DateTimeRange({
  startLabel = "시작",
  endLabel = "종료",
  startName,
  endName,
  defaultStart = "",
  defaultEnd = "",
  withTime = true,
  required,
  hint,
}: {
  startLabel?: string;
  endLabel?: string;
  startName: string;
  endName: string;
  defaultStart?: string;
  defaultEnd?: string;
  withTime?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  return (
    <>
      <DateTimePicker
        label={startLabel}
        name={startName}
        withTime={withTime}
        required={required}
        hint={hint}
        value={start}
        onChange={(next) => {
          setStart(next);
          if (next && (!end || end < next)) setEnd(withTime ? plusHour(next) : next);
        }}
      />
      <DateTimePicker
        label={endLabel}
        name={endName}
        withTime={withTime}
        required={required}
        min={start || undefined}
        value={end}
        onChange={setEnd}
        hint={start ? "시작보다 앞선 날짜·시각은 고를 수 없습니다." : undefined}
      />
    </>
  );
}

// "YYYY-MM-DDTHH:mm" + 1시간 (자정을 넘기면 그날 23:30으로 둔다)
export function plusHour(value: string): string {
  const [h, m] = value.slice(11, 16).split(":").map(Number);
  const next = h + 1 > 23 ? "23:30" : `${String(h + 1).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return `${value.slice(0, 10)}T${next}`;
}
