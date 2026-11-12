import { ActionForm } from "@/components/ui/action-form";
import { ManageMenu } from "@/components/ui/manage-menu";
import { isoToSeoulLocal } from "@/lib/dates";
import { SCHEDULE_COLORS, scheduleColor, type ScheduleColor } from "@/lib/schedules/colors";
import { timeLabel, type ScheduleTime } from "@/lib/schedules/week";
import { createSchedule, deleteSchedule, updateSchedule } from "./actions";
import { ScheduleFields, type ScheduleInitial } from "./schedule-fields";

// /schedule의 일정 목록·입력 폼

export type ScheduleRow = ScheduleTime & {
  id: string;
  title: string;
  location: string;
  description?: string;
  event_id: string | null;
  created_by: string;
  color?: string;
  event?: { name: string } | null;
};

function initialOf(s: ScheduleRow): ScheduleInitial {
  return {
    title: s.title,
    location: s.location,
    description: s.description ?? "",
    allDay: s.is_all_day,
    starts: s.is_all_day ? (s.start_date ?? "") : isoToSeoulLocal(s.starts_at),
    ends: s.is_all_day ? (s.end_date ?? "") : isoToSeoulLocal(s.ends_at),
    color: (s.color && s.color in SCHEDULE_COLORS ? s.color : "coral") as ScheduleColor,
  };
}

// canManage: 만든 사람·회장단·행사 관리자(DB 함수와 같은 기준)
export function ScheduleItem({ s, canManage, prefix }: { s: ScheduleRow; canManage: boolean; prefix?: string }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${scheduleColor(s.color).dot}`} />
        <span className="min-w-0">
          <span className="mr-2 text-sm font-semibold text-coral-800 dark:text-coral-300">{timeLabel(s)}</span>
          <span className="font-medium">{prefix && `${prefix} `}{s.title}</span>
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">
            {[s.event?.name, s.location].filter(Boolean).join(" · ") || "기수 공통"}
          </span>
          {s.description && <span className="mt-1 block whitespace-pre-wrap text-sm">{s.description}</span>}
        </span>
      </span>
      {canManage && (
        <ManageMenu
          title="일정 관리"
          subtitle={s.title}
          items={[
            {
              key: "edit",
              label: "수정",
              content: (
                <ActionForm action={updateSchedule} submitLabel="고친 내용 저장">
                  <input type="hidden" name="schedule_id" value={s.id} />
                  <ScheduleFields defaultDate={initialOf(s).starts.slice(0, 10)} initial={initialOf(s)} />
                </ActionForm>
              ),
            },
            {
              key: "delete",
              label: "삭제",
              danger: true,
              content: (
                <ActionForm action={deleteSchedule} submitLabel="삭제">
                  <p className="text-sm">이 일정을 지웁니다. 되돌릴 수 없습니다.</p>
                  <input type="hidden" name="schedule_id" value={s.id} />
                </ActionForm>
              ),
            },
          ]}
        />
      )}
    </li>
  );
}

export function NewScheduleForm({ defaultDate }: { defaultDate: string }) {
  return (
    <ActionForm action={createSchedule} submitLabel="일정 추가">
      <ScheduleFields defaultDate={defaultDate} />
    </ActionForm>
  );
}
