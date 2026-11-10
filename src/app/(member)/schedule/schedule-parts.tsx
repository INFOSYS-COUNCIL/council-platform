import { ActionForm } from "@/components/ui/action-form";
import { ManageMenu } from "@/components/ui/manage-menu";
import { scheduleColor } from "@/lib/schedules/colors";
import { timeLabel, type ScheduleTime } from "@/lib/schedules/week";
import { createSchedule, deleteSchedule } from "./actions";
import { ScheduleFields } from "./schedule-fields";

// /schedule과 행사 상세의 일정 구역이 함께 쓰는 목록·입력 폼

export type ScheduleRow = ScheduleTime & {
  id: string;
  title: string;
  location: string;
  event_id: string | null;
  created_by: string;
  color?: string;
  event?: { name: string } | null;
};

export function ScheduleItem({ s, canDelete }: { s: ScheduleRow; canDelete: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
      <span className="flex min-w-0 items-start gap-2.5">
        <span aria-hidden="true" className={`mt-1.5 size-2.5 shrink-0 rounded-full ${scheduleColor(s.color).dot}`} />
        <span className="min-w-0">
          <span className="mr-2 text-sm font-semibold text-coral-800 dark:text-coral-300">{timeLabel(s)}</span>
          <span className="font-medium">{s.title}</span>
          <span className="block text-sm text-zinc-600 dark:text-zinc-400">
            {[s.event?.name, s.location].filter(Boolean).join(" · ") || "기수 공통"}
          </span>
        </span>
      </span>
      {canDelete && (
        <ManageMenu
          title="일정 관리"
          subtitle={s.title}
          items={[
            {
              key: "delete",
              label: "삭제",
              danger: true,
              content: (
                <ActionForm action={deleteSchedule} submitLabel="삭제">
                  <p className="text-sm">이 일정을 지웁니다. 되돌릴 수 없습니다. 내용을 바꾸려면 지운 뒤 다시 추가해 주세요.</p>
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

export function NewScheduleForm({ eventId, defaultDate }: { eventId?: string; defaultDate: string }) {
  return (
    <ActionForm action={createSchedule} submitLabel="일정 추가">
      {eventId && <input type="hidden" name="event_id" value={eventId} />}
      <ScheduleFields defaultDate={defaultDate} />
    </ActionForm>
  );
}
