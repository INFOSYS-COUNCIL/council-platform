// 로그인 뒤 돌아갈 경로. 같은 사이트 안의 경로만 허용해 외부 주소로 보내는 공격을 막는다.
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/me",
): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.startsWith("/\\")
  ) {
    return fallback;
  }
  return next;
}
