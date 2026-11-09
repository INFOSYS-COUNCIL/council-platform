"use client";

import { useState } from "react";
import { DateTimeRange } from "@/components/ui/date-time-picker";
import { TextField } from "@/components/ui/form-field";
import { SCHEDULE_COLORS, type ScheduleColor } from "@/lib/schedules/colors";

// 일정 입력칸: 제목·장소, 종일 여부, 시작·종료(종료는 시작보다 앞설 수 없음), 색.
// 종일이면 "YYYY-MM-DD", 아니면 "YYYY-MM-DDTHH:mm"로 보낸다.
export function ScheduleFields({ defaultDate }: { defaultDate: string }) {
  const [allDay, setAllDay] = useState(false);
  const [color, setColor] = useState<ScheduleColor>("coral");
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="제목" name="title" required maxLength={100} />
        <TextField label="장소" name="location" maxLength={100} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} className="size-4 accent-coral-700" />
        하루 종일
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {/* key: 종일 여부가 바뀌면 값 형식이 달라지므로 새로 만든다 */}
        <DateTimeRange
          key={`${allDay}-${defaultDate}`}
          startName="starts"
          endName="ends"
          withTime={!allDay}
          required
          defaultStart={allDay ? defaultDate : `${defaultDate}T10:00`}
          defaultEnd={allDay ? defaultDate : `${defaultDate}T11:00`}
        />
      </div>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">색 <span className="font-normal text-zinc-600 dark:text-zinc-400">(달력에서 일정을 구분하는 색)</span></legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SCHEDULE_COLORS) as ScheduleColor[]).map((c) => (
            <label key={c} className="cursor-pointer" title={SCHEDULE_COLORS[c].label}>
              <input type="radio" name="color" value={c} checked={color === c} onChange={() => setColor(c)} className="peer sr-only" />
              <span
                className={`block size-8 rounded-full ${SCHEDULE_COLORS[c].dot} ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-zinc-900 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-blue-600 dark:peer-checked:ring-zinc-100`}
              />
              <span className="sr-only">{SCHEDULE_COLORS[c].label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
