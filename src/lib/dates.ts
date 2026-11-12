// 날짜 표시와 기한 판정. 학생회는 한국 시간 기준으로 일한다.
// DB의 date 열은 "YYYY-MM-DD" 문자열로 온다.

const TIME_ZONE = "Asia/Seoul";
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 지금 한국 날짜 ("YYYY-MM-DD")
export function todayInSeoul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// "2026-11-12" → "11월 12일 (목)". 연도가 올해와 다르면 앞에 붙인다.
export function formatDate(
  value: string | null | undefined,
  today: string = todayInSeoul(),
): string {
  if (!value) return "";
  const [y, m, d] = value.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const prefix = String(y) === today.slice(0, 4) ? "" : `${y}년 `;
  return `${prefix}${m}월 ${d}일 (${weekday})`;
}

// "YYYY-MM-DD"에 날짜 수를 더한다(시간대와 무관한 달력 계산)
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// 마감일이 오늘보다 앞이고 아직 완료되지 않았으면 기한 초과
export function isOverdue(
  dueDate: string | null | undefined,
  done: boolean,
  today: string = todayInSeoul(),
): boolean {
  return !done && !!dueDate && dueDate < today;
}

// <input type="datetime-local">의 "YYYY-MM-DDTHH:mm"(한국 시간) ↔ DB timestamptz
const LOCAL_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function seoulLocalToIso(value: string): string | null {
  return LOCAL_DATETIME.test(value) ? `${value}:00+09:00` : null;
}

export function isoToSeoulLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// "11월 12일 (목) 18:00"
export function formatDateTime(iso: string | null | undefined, today: string = todayInSeoul()): string {
  if (!iso) return "";
  const local = isoToSeoulLocal(iso);
  return `${formatDate(local.slice(0, 10), today)} ${local.slice(11)}`;
}
