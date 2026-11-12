import { TASK_STATUS_ORDER, type TaskStatus } from "./labels";

// /tasks 주소의 검색 조건(?tab=&status=&page=)을 안전한 값으로 바꾼다.
// 주소는 사용자가 마음대로 바꿀 수 있으므로 모르는 값은 기본값으로 둔다.

export const TASK_TABS = {
  mine: "내 업무",
  all: "전체 업무", // 회장단만
  archived: "보관함",
} as const;
export type TaskTab = keyof typeof TASK_TABS;

export const TASKS_PER_PAGE = 20;

export type TaskListParams = {
  tab: TaskTab;
  status: TaskStatus | null;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTaskListParams(raw: Raw, isExecutive: boolean): TaskListParams {
  const tabRaw = first(raw.tab);
  const allowed: TaskTab[] = isExecutive ? ["mine", "all", "archived"] : ["mine", "archived"];
  const tab = allowed.find((t) => t === tabRaw) ?? "mine";

  const statusRaw = first(raw.status);
  const status = TASK_STATUS_ORDER.find((s) => s === statusRaw) ?? null;

  const pageNumber = Number(first(raw.page));
  const page = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;

  return { tab, status, page };
}

// 같은 화면 안에서 조건 하나만 바꾼 주소. 탭·상태를 바꾸면 1쪽으로 돌아간다.
export function taskListHref(
  current: TaskListParams,
  change: Partial<TaskListParams>,
): string {
  const next = { ...current, ...change };
  if (change.tab !== undefined || change.status !== undefined) next.page = 1;
  const params = new URLSearchParams();
  if (next.tab !== "mine") params.set("tab", next.tab);
  if (next.status) params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
}
