<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 프로젝트 작업 규칙

작업 전에 `docs/TF_작업방식_GitHub_가이드.md`를 읽는다. 작업 방식·역할·협업 규칙의 기준은 이 가이드다. 기능 요구사항은 Issue와 기획서 v0.7에서 확인하며, 모르는 권한·데이터 구조를 추측해 확정하지 않는다.

진행 상태는 `docs/TF_진행현황_20261029.md`, 일정은 `docs/TF_주차별_진행계획_20261029.md`를 참고한다. 날짜가 있는 현황은 당시 기록이며 원격 설정·테스트 결과가 계속 같다고 가정하지 않는다. 로컬 파일 준비와 main 병합, 코드 구현과 대시보드 연결·실제 로그인 검증을 구분한다.

- 스택: Next.js 16 App Router, TypeScript, Tailwind, Supabase, Vercel. Node.js 24를 사용한다.
- Issue 하나 = 브랜치 하나 = PR 하나. 최신 `main`에서 시작한다. 브랜치 이름은 `<종류>/<이슈번호>-<짧은-영어-설명>`이다. `main` 직접 push·force push는 금지한다.
- Issue의 목표·수정 가능한 파일·준비된 것·완료 기준을 따른다. 사용자에게 명시적으로 요청받은 범위를 우선한다. 팀원 작업에서 공용 파일 변경이 필요하면 Issue 댓글로 리드에게 요청한다.
- 공용 파일은 리드가 관리한다: `supabase/**`, `package.json`, `package-lock.json`, `src/app/layout.tsx`, 내비게이션, `src/app/globals.css`, `src/lib/supabase/**`, `database.types.ts`, `src/components/ui/**`. 패키지를 임의로 추가하지 않는다.
- 초기 실습 Issue의 범위: #1은 `src/app/page.tsx`만, #2는 `src/app/login/**`만 수정한다. 공용 파일인 `src/app/layout.tsx`의 언어 설정·사이트 기본 제목은 리드가 처리한다. 예외로 #3은 새 `supabase/tests/positions_test.sql`만, #4는 새 `supabase/tests/terms_test.sql`만 추가할 수 있다. Migration·RLS·기존 공용 테스트는 변경하지 않는다. 자세한 범위는 `docs/TF_초기_Issue_정리안.md`에 있다.
- Git 작업 전 브랜치·변경 상태를 확인한다. 이미 Merge된 작업 브랜치에 새 일을 쌓지 않는다. 미커밋 작업을 보존하고 최신 main 기준의 새 브랜치로 옮긴다. 다른 브랜치에 남은 수정은 diff로 확인해 필요한 변경만 포함한다.
- DB 구조·RLS·서버 함수·타입·공용 부품은 리드의 기반 작업이다. 팀원은 준비된 기반을 사용해 화면 하나를 끝까지 완성하고 직접 검증한다. DB 타입은 `npm run db:types`로 생성하며 직접 수정하지 않는다.
- 실제 권한은 DB RLS가 강제한다. 화면에서 숨기는 것만으로 권한 검증을 대신하지 않는다. RLS 우회나 테스트 삭제로 문제를 덮지 않는다.
- DB 구조 변경은 Migration으로 기록한다. `db reset`은 `--local`에서만 실행한다. 공유 dev/prod DB는 초기화하지 않는다. Seed와 테스트에는 가짜 데이터만 쓴다.
- 키·비밀번호·OAuth Client Secret·service_role·실제 학생 정보·건의 원문을 코드, 문서, Issue, PR, AI 입력에 넣지 않는다. 환경변수 파일 내용을 출력하지 않는다.
- 화면은 로딩·빈 목록·오류·권한 없음, 권한 없는 계정의 URL 직접 접근, 키보드 조작, 375px 화면 폭을 확인한다.
- AI 작업은 계획 → 구현 → 확인 → 설명 → AI 리뷰 순서다. 사용자가 계획만 요청하거나 구현 전 확인을 요구하면 그 경계를 따른다. 작성자가 변경 이유를 설명할 수 있게 설명한다.
- PR 전 검사: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`. DB 변경은 `npx supabase test db`도 실행한다. CI `app`·`db`가 모두 통과해야 한다. 실행하지 못한 검사는 명시한다.
- 커밋·PR 제목: `<종류>(<영역>): <무엇을 했는지, 한국어> (#이슈번호)`. PR 첫 줄: `Closes #이슈번호`. 저장소 PR 템플릿을 채운다.
- 목요일 배정 → 화요일 23:59 PR → 수요일 상호 리뷰·수정·리드 최종 리뷰·순차 Merge다. 작성자가 먼저 AI 리뷰를 반영한다. 리뷰어는 다른 팀의 같은 역할 담당자다.
- Merge는 리드가 Squash로 진행한다. 하나를 Merge한 뒤 남은 PR은 최신 `main`을 반영하고 CI를 다시 확인한다.
- 30분 넘게 막히면 시도·오류·기대 결과를 Issue 댓글에 남기고 `blocked`로 공유한다.
