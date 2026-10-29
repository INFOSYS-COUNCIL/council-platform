// 로그인 뒤 처음 보낼 화면 (기획서 부록 C.2).
// 건의 화면(/suggestions)이 생기면 일반 학생의 첫 화면을 그곳으로 바꾼다.
export function homePathFor(hasActiveMembership: boolean): string {
  return hasActiveMembership ? "/dashboard" : "/me";
}
