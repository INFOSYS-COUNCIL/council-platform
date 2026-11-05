# 학생회 운영 플랫폼 (council-platform)

정보시스템학과 학생회 운영 플랫폼입니다. **작업 방식·역할·협업 규칙의 기준은 [TF 작업 방식 · GitHub 협업 가이드](docs/TF_작업방식_기준.md)**입니다. 이 README는 설치·실행 안내이며, 협업 규칙이 다르면 가이드를 따릅니다.

- 일정: [10월 29일 시작 주차별 진행계획](docs/TF_일정.md)
- 완료·미완료 현황과 초기 Issue: [10월 29일 진행 현황](docs/TF_남은%20일_체크리스트.md). 협업 파일은 로컬 준비 상태와 main 반영 상태를 구분합니다.
- 기능 요구사항·권한 표·데이터 구조·화면 주소: [기획서 v0.8](docs/학생회_운영플랫폼_기획서.md). 기능별 Issue에는 필요한 절만 옮깁니다.

- 스택: Next.js 16 (App Router, TypeScript, Tailwind) · Supabase (Auth, Postgres + RLS) · Vercel
- **이 저장소는 공개 저장소입니다.** 비밀 키와 실제 학생 정보(이름, 이메일, 학번, UID)는 절대 커밋하지 않습니다.

## 1. 필요한 도구

### 필수

| 도구 | 용도 | Windows | Mac |
| --- | --- | --- | --- |
| Git | 버전 관리 | `winget install Git.Git` | `brew install git` |
| Node.js **24** | 앱 실행 | 아래 참고 | `brew install node@24` |
| Docker Desktop | 로컬 DB | `winget install Docker.DockerDesktop` | `brew install --cask docker` |
| VS Code | 코드 편집 | `winget install Microsoft.VisualStudioCode` | `brew install --cask visual-studio-code` |

- **Node는 반드시 24 버전**입니다. 최신 LTS가 24보다 높을 수 있으니 https://nodejs.org/en/download 에서 **v24**를 골라 설치합니다.
- **Docker Desktop**은 Windows에서 WSL2가 필요합니다. 설치 중 WSL2 안내가 나오면 따르고 재부팅합니다. 설치 후 Docker Desktop을 실행해 상태가 Running인지 확인합니다.
- Supabase CLI는 프로젝트 개발 의존성으로 설치되므로 따로 설치하지 않습니다. 항상 `npx supabase ...`로 실행합니다.

### 권장

| 도구 | 용도 | Windows | Mac |
| --- | --- | --- | --- |
| Fork | Git GUI (브랜치·커밋·충돌 해결을 화면으로) | `winget install Fork.Fork` | `brew install --cask fork` |
| Starship | 터미널 프롬프트 (브랜치·Node 버전 표시) | `winget install Starship.Starship` | `brew install starship` |
| JetBrainsMono Nerd Font | Starship 아이콘 표시용 글꼴 | `winget install DEVCOM.JetBrainsMonoNerdFont` | `brew install --cask font-jetbrains-mono-nerd-font` |

**Starship 켜기 (설치 후 한 번)**

- Windows (PowerShell)
  1. `notepad $PROFILE` 실행 (파일이 없으면 만들겠냐고 물으면 '예')
  2. 맨 아래에 `Invoke-Expression (&starship init powershell)` 추가 후 저장
  3. Windows Terminal → 설정 → 프로필 → 기본값 → 모양 → 글꼴을 `JetBrainsMono Nerd Font`로 변경
  4. 터미널 다시 열기
- Mac (zsh): `~/.zshrc` 맨 아래에 `eval "$(starship init zsh)"` 추가, 터미널 글꼴을 Nerd Font로 변경

**VS Code 확장** (Extensions에서 검색)

- ESLint: 코드 규칙 오류를 바로 표시
- Tailwind CSS IntelliSense: Tailwind 클래스 자동완성
- Korean Language Pack: 한국어 메뉴 (선택)

### 설치 확인

```bash
git --version   # 버전이 나오면 OK
node -v         # v24로 시작해야 함
docker info     # 오류 없이 정보가 나와야 함 (Docker Desktop 실행 중)
```

## 2. 처음 한 번 설정

```bash
git clone <저장소 주소>
cd council-platform
npm ci                       # package-lock.json 그대로 설치
cp .env.example .env.local   # 환경변수 파일 만들기
npx supabase start           # 로컬 DB 시작 (처음엔 Docker 이미지를 받느라 오래 걸림)
npx supabase status          # 출력된 값을 .env.local에 채우기
```

`.env.local`에 채우는 값:

| 변수 | `supabase status`의 항목 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (보통 `http://127.0.0.1:54321`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key (`sb_publishable_...`) |

Secret key나 service_role key는 `.env.local`에도 넣지 않습니다.

## 3. 매일 실행

```bash
npx supabase start   # Docker Desktop을 먼저 켜 둘 것
npm run dev          # http://localhost:3000
```

Supabase Studio(로컬 DB 관리 화면): http://127.0.0.1:54323

작업이 끝나면 `npx supabase stop`으로 DB를 끕니다. 데이터는 남아 있습니다.

## 4. 로컬 DB 다루기

```bash
npx supabase db reset --local   # DB를 지우고 Migration + seed.sql을 처음부터 다시 적용
npx supabase test db            # supabase/tests/의 pgTAP 테스트 실행
npx supabase migration new <이름> # 새 Migration 파일 만들기
npm run db:types                # DB 구조가 바뀌면 TypeScript 타입 다시 생성
```

- **`db reset`은 반드시 `--local`로만 실행합니다.** 공유 dev/prod DB에서는 절대 초기화하지 않습니다.
- DB 구조는 Studio 화면에서 직접 바꾸지 말고 **Migration 파일로만** 바꿉니다.
- `supabase/seed.sql`에는 **가짜 데이터만** 넣습니다.
- **새 테이블은 권한을 직접 GRANT해야 API에서 보입니다.** 원격 프로젝트는 "새 테이블 자동 노출"을 꺼 두었고, 로컬도 같게 맞췄습니다. Migration에 `grant select ... to authenticated`와 RLS 정책을 함께 적습니다. (예: `supabase/migrations/*_membership_auth.sql`)
- 권한 판정 함수는 `private` 스키마에 둡니다 (`private.is_member(term_id)`, `private.is_executive(term_id)` 등).

| 폴더 | 내용 |
| --- | --- |
| `supabase/migrations/` | DB 구조와 RLS 정책의 변경 이력 |
| `supabase/seed.sql` | 로컬 개발용 가짜 데이터 |
| `supabase/tests/` | 권한 허용·거부 DB 테스트 (pgTAP) |

## 5. 코드 검사

PR을 올리기 전에 아래가 모두 통과해야 합니다. CI에서도 같은 검사를 돌립니다.

```bash
npm run lint        # 코드 규칙 (next build는 lint를 돌리지 않으므로 따로 실행)
npm run typecheck   # TypeScript 타입 검사
npm test            # Vitest 단위 테스트 (src/**/*.test.ts)
npm run build       # 배포 빌드
npx supabase test db
```

CI(`.github/workflows/ci.yml`)는 `app`(lint → typecheck → test → build)과 `db`(새 DB에 Migration 적용 → pgTAP) 두 작업을 돌립니다.

## 6. 폴더 구조

```text
src/
  app/                 화면 (폴더 = 주소)
    (member)/          구성원 전용 화면. 괄호 폴더는 주소에 나타나지 않음 (공통 메뉴 layout.tsx)
      dashboard/       대시보드 (/dashboard)
    login/             로그인 화면
    auth/callback/     Google 로그인 후 세션 교환 + 소속 활성화 + 첫 화면 결정
    auth/signout/      로그아웃 (POST)
    me/                내 계정·소속 확인
    error.tsx          예상하지 못한 오류 화면
    not-found.tsx      없는 화면·권한 없음 화면
  components/ui/       여러 화면에서 쓰는 부품 (버튼, 알림, 빈 목록, 화면 제목)
  lib/supabase/
    client.ts          브라우저(Client Component)용 Supabase 클라이언트
    server.ts          서버(Server Component·Action)용 Supabase 클라이언트
    proxy.ts           요청마다 로그인 토큰을 갱신하는 함수
    database.types.ts  DB 타입 (npm run db:types로 생성, 직접 수정 금지)
  lib/auth/
    session.ts         로그인·소속 확인 (requireUser, requireMember). 모든 page·Server Action에서 사용
    home.ts            로그인 뒤 첫 화면 (구성원 /dashboard, 학생 /me)
    email.ts           학교 이메일 판정
    redirect.ts        로그인 후 돌아갈 경로 검사
  proxy.ts             Next.js Proxy (예전 이름: middleware)
supabase/              로컬 DB 설정, Migration, Seed, 테스트
```

서버에서 "누가 로그인했는가"를 판단할 때는 `supabase.auth.getClaims()` 또는 `getUser()`를 씁니다. `getSession()`의 결과만으로 권한을 판단하지 않습니다. 실제 권한은 DB의 RLS가 강제합니다.

### 로그인 흐름

```text
/login → Google (학교 계정 선택)
  → Supabase Auth Hook: Google·이메일 인증·@hanyang.ac.kr·hd 검사, 아니면 가입 거부
  → auth.users 생성 → 트리거가 profiles 생성 (같은 조건 재검사)
  → /auth/callback: 세션 교환 → activate_membership()
      ├─ 승인 명단에 있음 → memberships 생성 (회장단/국장/국원)
      └─ 없음 → 일반 학생
  → 돌아갈 주소(next)가 있으면 그곳, 없으면 구성원은 /dashboard, 일반 학생은 /me
```

- Cache Components가 켜져 있어서, 로그인 정보(쿠키)를 읽는 컴포넌트는 `<Suspense>` 안에 둡니다. (`src/app/me/page.tsx` 참고)
- 로컬에서 실제 Google 로그인을 해 보려면 개인 Google OAuth 클라이언트가 필요합니다. 없어도 DB 권한은 pgTAP 테스트로 확인할 수 있습니다.
  1. Google Cloud Console에서 OAuth 클라이언트(웹)를 만들고 Redirect URI에 `http://127.0.0.1:54321/auth/v1/callback` 추가
  2. `supabase/.env` 파일(커밋 금지)에 `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=...`, `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=...` 입력
  3. `npx supabase stop` → `npx supabase start`
  4. 로컬 DB에는 승인 명단이 비어 있으므로, 회장단 화면이 생기기 전까지는 아래 "첫 회장단 등록" SQL을 Studio에서 실행해 자기 계정을 등록합니다.

## 7. 브랜치와 PR 규칙

1. **Issue 하나 = 브랜치 하나 = PR 하나.** 리드가 Issue에 목표·담당·수정 가능한 파일·준비된 기반·완료 기준·읽을 강의를 적습니다.
2. `main`에서 브랜치를 만든다: `feat/이슈번호-짧은설명`, `fix/...`, `docs/...`
   - 예: `feat/12-task-list`
3. 목요일에 Issue를 받고 **화요일 20:00까지 PR**, 수요일에 상호 리뷰·수정·최종 리뷰·순차 Merge를 합니다.
4. 커밋·PR 제목은 `<종류>(<영역>): <무엇을 했는지, 한국어> (#이슈번호)`, PR 본문 첫 줄은 `Closes #이슈번호`로 씁니다. 작성자가 AI 리뷰를 먼저 반영하고 PR 템플릿을 채웁니다.
5. `app`·`db` CI, 승인 1명, Code Owner 승인, 대화 해결 후 **리드가 Squash and merge**합니다. `main` 직접 push·force push는 금지합니다. 브랜치 보호·Squash만 허용·Merge 후 브랜치 자동 삭제는 GitHub에서 별도로 설정해야 합니다.
6. 하나를 Merge한 뒤 남은 PR은 **Update branch**로 최신 `main`을 반영하고 CI가 다시 통과한 뒤 순서대로 Merge합니다. 오래 유지하는 브랜치는 `main` 하나입니다.

| 변경 | 1단계 리뷰어 |
| --- | --- |
| 화면 | 강주원 ↔ 정재헌 |
| 데이터 연결·테스트 | 이은규 ↔ 조수빈 |
| 리드의 DB·CI·공용 파일 | 이은규 또는 조수빈 |

A팀은 강주원·이은규, B팀은 정재헌·조수빈이며, 같은 짝끼리는 리뷰하지 않습니다. 모두 화면 하나를 처음부터 끝까지 맡고 직접 검증합니다. 1단계 리뷰어는 Preview를 직접 확인하며, 최종 리뷰·Merge는 한지석이 합니다. CODEOWNERS는 `* @hkg109`로 모든 변경에 리드의 승인을 요청합니다.

리드는 다음 주 기능의 DB·RLS·서버 함수·타입·공용 부품·화면 경로를 한 주 먼저 준비합니다. 팀원은 Issue에 허용된 파일만 수정합니다. `supabase/**`, 패키지 파일, layout·내비게이션, `globals.css`, `src/lib/supabase/**`, DB 타입, `src/components/ui/**`는 리드가 관리합니다. 공용 파일 변경과 패키지 추가는 Issue 댓글로 요청합니다.

초기 실습 Issue 4개는 서로 다른 파일을 다루므로 동시에 시작합니다. #1은 `src/app/page.tsx`, #2는 `src/app/login/**`만 수정하고, `layout.tsx`의 언어 설정·사이트 제목은 리드가 처리합니다. 예외로 #3은 새 `supabase/tests/positions_test.sql`, #4는 새 `supabase/tests/terms_test.sql`만 추가할 수 있습니다. Migration·RLS·기존 공용 테스트 수정까지 허용하는 뜻은 아닙니다. [초기 Issue 정리안](docs/GitHub_Issue_초기_정리안.md)을 참고합니다.

PR은 가이드 3.3절의 8개 항목(완료 기준·화면 상태·권한·보안·범위·정리·접근성·설명)을 확인합니다. 화면 상태 4가지는 로딩·빈 목록·오류·권한 없음입니다.

30분 넘게 막히면 시도한 일·오류·기대 결과를 Issue 댓글에 남기고 `blocked` 라벨을 붙입니다. 단톡에는 Issue 링크를 공유합니다.

## 8. 배포와 DB 변경

배포(Vercel)와 DB 변경(Supabase Migration)은 **따로** 일어납니다.

- Preview 배포 → `council-dev` Supabase, Production 배포 → `council-prod` Supabase
- 운영 배포 전에 운영 DB에 새 Migration이 적용됐는지 먼저 확인합니다.
  1. PR에 Migration이 있으면 `council-dev`에 먼저 적용해 Preview에서 확인
  2. Merge 직전, 리드가 `council-prod`에 Migration 적용 (아래 명령)
  3. 적용 확인 후 Merge → Production 자동 배포

```bash
npx supabase login                                   # 처음 한 번 (공용 계정)
npx supabase link --project-ref <dev 또는 prod ref>   # 대상 프로젝트 선택
npx supabase db push --dry-run --linked              # 적용할 Migration 목록만 확인
npx supabase db push --linked                        # 실제 적용
npx supabase link --project-ref <dev ref>            # 끝나면 dev로 되돌려 둔다 (prod 실수 방지)
```

- 원격 DB 작업은 대상을 명확히 하도록 `--linked`를 꼭 붙인다.
- 원격 DB에는 `db reset`을 절대 쓰지 않는다. `seed.sql`은 원격에 들어가지 않는다.

### Supabase 대시보드 설정 (dev·prod 각각, 리드)

Migration 외에 대시보드에서 직접 켜야 하는 설정입니다.

1. Authentication → Sign In / Providers
   - **Google** 켜고 Client ID·Secret 입력 (Google Cloud Console의 Redirect URI: `https://<프로젝트ref>.supabase.co/auth/v1/callback`)
   - Email 등 Google 외 Provider는 모두 끔
2. Authentication → URL Configuration
   - Site URL: 배포 주소
   - Redirect URLs: `http://localhost:3000/auth/callback`, 배포 주소의 `/auth/callback`, Preview 주소 패턴
3. Authentication → Hooks → **Before User Created** → Postgres 함수 `public.hook_before_user_created` 연결
4. 학교 계정과 외부 Gmail로 한 번씩 로그인해 보고, 외부 Gmail이 거부되고 `auth.users`에 행이 생기지 않는지 확인

### 첫 회장단 등록 (기수마다 한 번, 비상 절차)

회장단이 아무도 없을 때만 씁니다. 그 뒤의 구성원 등록은 회장단 화면에서 합니다. 실제 이메일은 실행할 때만 입력하고 저장소·단톡에 남기지 않습니다.

대시보드 SQL Editor에서:

```sql
-- 1) 기수가 없으면 만든다 (ACTIVE는 하나만 가능)
insert into public.terms (name, status, starts_on, ends_on)
values ('2027 제N대 학생회', 'ACTIVE', '2027-03-01', '2028-02-28')
returning id;

-- 2) 그 기수의 첫 회장단 승인 행을 만든다
select private.bootstrap_first_executive('<위에서 나온 기수 id>', '<회장 학교 이메일>');
```

해당 사용자가 로그아웃 후 다시 로그인하면 회장단 Membership이 생깁니다. `/me`에서 "회장단"으로 보이는지 확인합니다.

## 9. 절대 하지 말 것

- 비밀 키(Secret key, service_role key, OAuth Client Secret, DB 비밀번호)를 코드·Issue·PR·단톡에 붙여 넣기
- 실제 학생 이름·이메일·학번을 Migration, Seed, 테스트에 넣기
- 공유 DB에서 `db reset` 하기
- 비밀 값이 유출되면 즉시 리드에게 알리고 키를 폐기·재발급합니다.
