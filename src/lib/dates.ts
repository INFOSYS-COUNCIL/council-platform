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

// 마감일이 오늘보다 앞이고 아직 완료되지 않았으면 기한 초과
export function isOverdue(
  dueDate: string | null | undefined,
  done: boolean,
  today: string = todayInSeoul(),
): boolean {
  return !done && !!dueDate && dueDate < today;
}
