// 일정 색(구분용). DB의 schedules_color_check와 같은 값이어야 한다.
// Tailwind가 class를 찾을 수 있도록 class 이름을 그대로 적는다.
export const SCHEDULE_COLORS = {
  coral: { label: "코랄", dot: "bg-coral-500", chip: "bg-coral-100 text-coral-900 dark:bg-coral-900/50 dark:text-coral-200" },
  orange: { label: "주황", dot: "bg-orange-500", chip: "bg-orange-100 text-orange-900 dark:bg-orange-900/50 dark:text-orange-200" },
  amber: { label: "노랑", dot: "bg-amber-400", chip: "bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200" },
  green: { label: "초록", dot: "bg-green-500", chip: "bg-green-100 text-green-900 dark:bg-green-900/50 dark:text-green-200" },
  teal: { label: "청록", dot: "bg-teal-500", chip: "bg-teal-100 text-teal-900 dark:bg-teal-900/50 dark:text-teal-200" },
  blue: { label: "파랑", dot: "bg-sky-500", chip: "bg-sky-100 text-sky-900 dark:bg-sky-900/50 dark:text-sky-200" },
  violet: { label: "보라", dot: "bg-violet-500", chip: "bg-violet-100 text-violet-900 dark:bg-violet-900/50 dark:text-violet-200" },
  pink: { label: "분홍", dot: "bg-pink-500", chip: "bg-pink-100 text-pink-900 dark:bg-pink-900/50 dark:text-pink-200" },
} as const;

export type ScheduleColor = keyof typeof SCHEDULE_COLORS;

export function scheduleColor(value: string | null | undefined) {
  return SCHEDULE_COLORS[(value ?? "coral") as ScheduleColor] ?? SCHEDULE_COLORS.coral;
}
