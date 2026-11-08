import { ActionForm } from "@/components/ui/action-form";
import { TextField } from "@/components/ui/form-field";
import { formatDate } from "@/lib/dates";
import { timeLabel, type ScheduleTime } from "@/lib/schedules/week";
import { createSchedule, deleteSchedule } from "./actions";

// /schedule과 행사 상세의 일정 구역이 함께 쓰는 목록·입력 폼

export type ScheduleRow = ScheduleTime & {
  id: string;
  title: string;
  location: string;
  event_id: string | null;
  created_by: string;
  event?: { name: string } | null;
};

export function ScheduleItem({ s, canDelete }: { s: ScheduleRow; canDelete: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <span>
        <span className="mr-2 text-sm font-semibold text-coral-800 dark:text-coral-300">{timeLabel(s)}</span>
        <span className="font-medium">{s.title}</span>
        <span className="block text-sm text-zinc-600 dark:text-zinc-400">
          {[s.event?.name, s.location].filter(Boolean).join(" · ") || "기수 공통"}
        </span>
      </span>
      {canDelete && (
        <ActionForm action={deleteSchedule} submitLabel="지우기" variant="secondary" confirmMessage={`"${s.title}" 일정을 지울까요?`}>
          <input type="hidden" name="schedule_id" value={s.id} />
        </ActionForm>
      )}
    </li>
  );
}

export function NewScheduleForm({ eventId, defaultDate }: { eventId?: string; defaultDate: string }) {
  return (
    <ActionForm action={createSchedule} submitLabel="일정 추가" variant="secondary">
      {eventId && <input type="hidden" name="event_id" value={eventId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="제목" name="title" required maxLength={100} />
        <TextField label="장소" name="location" maxLength={100} />
        <TextField label="시작 날짜" name="start_date" type="date" required defaultValue={defaultDate} />
        <TextField label="시작 시각" name="start_time" type="time" hint="시각을 둘 다 비우면 종일 일정" />
        <TextField label="종료 날짜" name="end_date" type="date" hint={`비우면 시작 날짜 (${formatDate(defaultDate)})와 같음`} />
        <TextField label="종료 시각" name="end_time" type="time" />
      </div>
    </ActionForm>
  );
}
