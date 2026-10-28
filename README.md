# 학생회 운영 플랫폼 (council-platform)

정보시스템학과 학생회 운영 플랫폼입니다. 무엇을 만드는지는 기획서 v0.7, 일정과 역할은 진행계획 문서를 기준으로 합니다.

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
```

- **`db reset`은 반드시 `--local`로만 실행합니다.** 공유 dev/prod DB에서는 절대 초기화하지 않습니다.
- DB 구조는 Studio 화면에서 직접 바꾸지 말고 **Migration 파일로만** 바꿉니다.
- `supabase/seed.sql`에는 **가짜 데이터만** 넣습니다.

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
npm run build       # 배포 빌드
npx supabase test db
```

## 6. 폴더 구조

```text
src/
  app/                 화면 (폴더 = 주소)
  lib/supabase/
    client.ts          브라우저(Client Component)용 Supabase 클라이언트
    server.ts          서버(Server Component·Action)용 Supabase 클라이언트
    proxy.ts           요청마다 로그인 토큰을 갱신하는 함수
  proxy.ts             Next.js Proxy (예전 이름: middleware)
supabase/              로컬 DB 설정, Migration, Seed, 테스트
```

서버에서 "누가 로그인했는가"를 판단할 때는 `supabase.auth.getClaims()` 또는 `getUser()`를 씁니다. `getSession()`의 결과만으로 권한을 판단하지 않습니다. 실제 권한은 DB의 RLS가 강제합니다.

## 7. 브랜치와 PR 규칙

1. Issue를 먼저 만들거나 배정받는다. (완료 기준과 읽을 강의가 적혀 있음)
2. `main`에서 브랜치를 만든다: `feat/이슈번호-짧은설명`, `fix/...`, `docs/...`
   - 예: `feat/12-task-list`
3. 작게 커밋하고, **수요일 밤까지** PR을 올린다.
4. PR 설명에 실행 방법, 화면, 허용·거부 테스트 결과를 적는다.
5. CI 통과 + 리뷰 1명 승인 후 Merge한다. `main`에 직접 push하지 않는다.

| 변경 | 리뷰어 |
| --- | --- |
| 화면 코드 | 다른 팀 화면 담당 (강주원 ↔ 정재헌) |
| 서버·DB 함수 | 다른 팀 서버·DB 담당 (이은규 ↔ 조수빈) |
| RLS·Migration·워크플로 | 한지석 필수 + 서버·DB 담당 1명 |

막히면 30분 넘게 혼자 붙잡지 말고 Issue 댓글이나 단톡에 질문합니다.

## 8. 배포와 DB 변경

배포(Vercel)와 DB 변경(Supabase Migration)은 **따로** 일어납니다.

- Preview 배포 → `council-dev` Supabase, Production 배포 → `council-prod` Supabase
- 운영 배포 전에 운영 DB에 새 Migration이 적용됐는지 먼저 확인합니다.
  1. PR에 Migration이 있으면 `council-dev`에 먼저 적용해 Preview에서 확인
  2. Merge 직전, 리드가 `council-prod`에 Migration 적용 (`npx supabase db push`, 프로젝트 link 필요)
  3. 적용 확인 후 Merge → Production 자동 배포

## 9. 절대 하지 말 것

- 비밀 키(Secret key, service_role key, OAuth Client Secret, DB 비밀번호)를 코드·Issue·PR·단톡에 붙여 넣기
- 실제 학생 이름·이메일·학번을 Migration, Seed, 테스트에 넣기
- 공유 DB에서 `db reset` 하기
- 비밀 값이 유출되면 즉시 리드에게 알리고 키를 폐기·재발급합니다.
