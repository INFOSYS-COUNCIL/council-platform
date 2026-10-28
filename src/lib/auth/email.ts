// 학교 계정 판정. DB의 private.is_school_email()과 같은 규칙이다.
// 화면 안내용이며, 실제 차단은 DB(Auth Hook·가입 트리거·activate_membership)가 한다.
export const SCHOOL_EMAIL_DOMAIN = "hanyang.ac.kr";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSchoolEmail(
  email: string | null | undefined,
  domain: string = SCHOOL_EMAIL_DOMAIN,
): boolean {
  if (!email) return false;

  const normalized = normalizeEmail(email);
  if (!/^[^@\s]+@[^@\s]+$/.test(normalized)) return false;

  return normalized.split("@")[1] === domain;
}
