# 초기 Issue 범위 (2026-10-29 확정)

첫 주 Issue #1~#4의 확정 범위다. GitHub의 Issue 본문은 리드가 이 범위대로 갱신한다. 이 파일만으로 원격 Issue가 수정됐다고 보지 않는다.

**공통:** 마감 11/3(화) 23:59 PR · 11/4(수) 상호 리뷰·리드 리뷰·순차 Merge · 11/5(목) 모임에서 결과 확인. Milestone `1주차 (11/5)`. 네 Issue는 서로 다른 파일만 다루므로 동시에 시작한다. 읽을 강의에는 필수 강의(웹앱 지도 · GitHub 협업 · AI 협업)를 공통으로 넣는다.

| Issue | 담당 → 1단계 리뷰 | 브랜치 | 수정 가능한 파일 | 추가 강의 |
|---|---|---|---|---|
| #1 첫 화면 문구와 페이지 정보 한국어로 바꾸기 | 강주원 → 정재헌 | `feat/1-home-copy` | `src/app/page.tsx`만 | Next.js 화면 구조 · React UI |
| #2 로그인 화면 접근성 점검과 개선 | 정재헌 → 강주원 | `feat/2-login-a11y` | `src/app/login/**`만 | React UI (접근성) |
| #3 Seed 데이터 조회하고 직책 거부 테스트 추가 | 이은규 → 조수빈 | `test/3-positions-deny` | 새 `supabase/tests/positions_test.sql`만 | 디버깅·테스트 · 인증·권한 |
| #4 기수 데이터 규칙 거부 테스트 추가 | 조수빈 → 이은규 | `test/4-terms-deny` | 새 `supabase/tests/terms_test.sql`만 | 디버깅·테스트 · 인증·권한 |

## #1 · 첫 화면

- 목표: 처음 들어온 학생이 첫 화면에서 학생회 운영 플랫폼임을 바로 알 수 있다.
- 완료 기준: Next.js 기본 로고·링크·문구 제거 / h1 1개·한 줄 소개·`/login`으로 가는 "학교 Google 계정으로 로그인" 버튼 / `page.tsx`의 `metadata`로 탭 제목 한국어 / 375px에서 잘리지 않음 / lint·typecheck·build 통과
- 하지 않는 것: 로그인 기능(이미 `/login`에 있음), `layout.tsx`·`globals.css` 수정. `<html lang="ko">`와 사이트 기본 제목은 리드가 처리했다.

## #2 · 로그인 화면 접근성

- 목표: 키보드만 쓰는 사용자도 로그인 버튼까지 막힘없이 도달하고 현재 위치를 볼 수 있다.
- 완료 기준: Tab으로 버튼 도달·focus 테두리가 배경과 구분 / 오류 문구가 스크린리더에 읽힘(`role="alert"` 유지, `/login?error=access_denied`로 확인) / 375px에서 깨지지 않음 / Lighthouse 접근성 결과와 확인 방법을 PR에 첨부 / lint·typecheck·build 통과
- 하지 않는 것: Google 연결·콜백·인증 판정 변경, 첫 화면(#1 담당).
- 이전 본문의 "#1 Merge 후 시작" 조건은 없앤다.

## #3 · 직책 거부 테스트

- 목표: positions 테이블이 잘못된 접근과 중복을 막는지 자동 테스트로 확인한다.
- 완료 기준: Studio SQL Editor에서 2026 테스트 학생회의 직책을 `sort_order` 순으로 조회한 캡처 / anon 조회 거부(`42501`) / 같은 기수 같은 이름 직책 중복 거부(`23505`) / 테스트 이름은 "누가 / 무엇을 / 거부된다" 한국어 문장 / `npx supabase test db` 통과
- 참고: 2차 Migration 이후 anon은 테이블 권한이 없어 빈 결과가 아니라 권한 오류(`42501`)가 난다.
- 하지 않는 것: Migration·RLS·seed·기존 테스트 수정.

## #4 · 기수 거부 테스트

- 목표: terms 테이블이 잘못된 날짜·중복·직접 수정을 막는지 자동 테스트로 확인한다.
- 완료 기준: Studio에서 CLOSED 기수와 그 부서를 조회한 캡처 / 종료일이 시작일보다 빠른 기수 거부(`23514`) / 같은 이름 기수 중복 거부(`23505`) / authenticated의 UPDATE 거부(`42501`) / 조건을 바꿔 테스트가 실제로 실패하는지 확인한 결과를 PR에 기록 / `npx supabase test db` 통과
- 하지 않는 것: Migration·RLS·seed·기존 테스트 수정.

#3·#4는 `supabase/` 공용 영역에 새 파일 하나만 추가하는 초기 실습 예외다. CODEOWNERS 때문에 리드 승인이 필수다. 이후 기능 작업은 각 담당자가 화면 하나를 끝까지 맡는 기본 원칙을 따른다.
