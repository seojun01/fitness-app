# Tasks: 운동 루틴 관리 및 세트 기록

**Input**: Design documents from `/specs/001-routine-workout-logging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sync-api.md, contracts/admin-cli.md, quickstart.md

**Tests**: 포함한다. 헌법의 개발 워크플로(도메인 로직은 테스트 먼저, 핵심 흐름은 E2E)와 plan.md R18에 따라, 각 단계에서 **테스트 작업을 구현 작업보다 먼저 작성하고 실패를 확인한 뒤** 구현한다.

**Organization**: 사용자 스토리(US1~US4)별로 묶는다. 각 스토리는 독립적으로 구현·검증할 수 있다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일이고 미완료 작업에 의존하지 않아 병렬 실행 가능
- **[Story]**: US1(루틴 관리), US2(세트 기록), US3(오프라인·동기화), US4(기록 조회)
- 경로는 저장소 루트 기준. 구조는 plan.md의 Project Structure를 따른다.
- 모든 UI 출력은 `textContent`로만 한다(`innerHTML` 금지). 모든 화면에 로딩·빈·오류 상태를 둔다(FR-015).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 프로젝트 초기화. todo-app(`~/Documents/todo-app`)의 같은 파일을 참고한다.

- [X] T001 저장소 루트에 `package.json`을 만든다: `"type": "module"`, `"engines": {"node": ">=22.18"}`, scripts `dev`/`build`/`test`/`test:e2e`/`typecheck`/`lint`(todo-app과 같은 형태, 서버 시작은 `FITNESS_DEV=1 node server/src/main.ts`), `bin`에 `fitness-admin`(`server/src/admin-cli.ts`), 런타임 `dependencies`는 비워 둔다. devDependencies: `typescript`, `esbuild`, `@playwright/test`, `@axe-core/playwright`, `fake-indexeddb`, `@types/node`
- [X] T002 [P] `tsconfig.json`을 만든다: `strict`, `target ES2022`, `noEmit`, `allowImportingTsExtensions`, `erasableSyntaxOnly`(enum·namespace·parameter property 금지), `shared/`·`server/`·`client/`·`e2e/`·`scripts/` 포함
- [X] T003 [P] `scripts/build.mjs`를 만든다: `client/public`을 `client/dist`로 복사, esbuild로 `client/src/main.ts`(ESM)와 `client/src/sw.ts`(IIFE, `__BUILD_ID__` 정의) 번들 (todo-app의 `scripts/build.mjs` 참고)
- [X] T004 [P] `scripts/lint.mjs`를 만든다: `innerHTML`·`outerHTML`·`insertAdjacentHTML`·`document.write` 사용 0건, `package.json`의 런타임 `dependencies`가 비어 있음, 런타임 코드가 외부 패키지를 import하지 않음을 검사하고 `npm run lint`가 `tsc --noEmit`과 함께 실행하게 한다
- [X] T005 [P] `playwright.config.ts`를 만든다: 개발 서버 자동 기동(`FITNESS_DEV=1`, 임시 DB), Chromium + WebKit, 모바일 뷰포트(390×844)와 320px 프로젝트 하나
- [X] T006 [P] 디렉터리 골격과 `.gitignore`(`node_modules/`, `client/dist/`, `test-results/`, `*.db`)를 만든다: `shared/tests`, `server/src`, `server/tests/{contract,unit,helpers}`, `client/src/{store,sync,ui}`, `client/tests`, `client/public`, `e2e`, `deploy`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 의존하는 공용 로직, 서버, 클라이언트 저장소·앱 셸

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 사용자 스토리도 시작하지 않는다.

### 공용 로직 테스트 (먼저 작성, 실패 확인)

- [X] T007 [P] `shared/tests/hlc.test.ts`: HLC 문자열이 `<wallMs 15자리 0채움>-<counter 6자리 0채움>-<deviceId>` 형식이고 문자열 비교 순서가 시간 순서와 같음, 시계가 뒤로 가도 단조 증가, 수신한 version을 반영해 갱신
- [X] T008 [P] `shared/tests/merge.test.ts`: `merge(stored, incoming)`은 `version`이 더 큰 쪽이 이기고, 같으면 stored 유지(멱등), 툼스톤도 같은 규칙, 서로 다른 type은 섞이지 않음
- [X] T009 [P] `shared/tests/model.test.ts`: data-model 검증 규칙을 그대로 검사한다 — 이름은 공백 제거 후 1~60자(코드 포인트), 루틴 `items` 0~50개, `targetSets` 1~20, 세션 `entries` 0~50개, 항목당 `sets` 0~50개, `weightKg` 0 이상 1000 이하, `reps` 1 이상 999 이하 정수, `status=completed`이면 `endedAt` 필수이고 `endedAt ≥ startedAt`, 알 수 없는 type·필드 거부, 툼스톤은 `id`·`version`·`updatedBy`만 있어도 통과
- [X] T010 [P] `shared/tests/units.test.ts`: `kg = lb × 0.45359237`, 저장 전 kg를 소수 넷째 자리 반올림, 표시는 lb를 소수 첫째 자리 반올림, 표시는 소수 둘째 자리까지 반올림하고 불필요한 끝자리 0을 제거(45.00→`45`, 45.50→`45.5`), lb·kg 모두 소수 둘째 자리 입력(예: 45, 45.5, 100.25, 0.01)이 저장→표시 왕복에서 입력과 같음(SC-006), `weightUnit`은 `"kg"` 또는 `"lb"`만 허용

### 공용 로직 구현

- [X] T011 [P] `shared/hlc.ts`를 구현한다 (T007 통과)
- [X] T012 [P] `shared/merge.ts`를 구현한다 (T008 통과)
- [X] T013 `shared/model.ts`에 타입(`Exercise`, `Routine`, `RoutineItem`, `Session`, `SessionEntry`, `SetEntry`, `Settings`, `BodyPart`, 공통 필드 `id`/`deleted`/`version`/`updatedBy`)과 `validateRecord(type, record)`를 구현한다 — T009의 규칙을 그대로 따르고 오류는 `{field, rule}` 목록으로 돌려준다 (T009 통과)
- [X] T014 [P] `shared/units.ts`를 구현한다: `toKg(value, unit)`(kg를 소수 넷째 자리로 반올림), `fromKg(kg, unit)`, `formatWeight(kg, unit)`(소수 둘째 자리, 끝자리 0 제거) (T010 통과)
- [X] T015 [P] `shared/seed-exercises.ts`에 부위(chest, back, shoulders, legs, arms, core, cardio)별 기본 종목 약 40개를 고정 UUID와 `bodyweight` 표지와 함께 정의한다 (research R15). 같은 id가 중복되지 않는지 `shared/tests/seed.test.ts`로 확인한다

### 서버 계약 테스트 (먼저 작성, 실패 확인)

- [X] T016 [P] `server/tests/helpers/server.ts`: 임시 DB로 서버를 띄우고 페어링 코드 발급→기기 등록→쿠키를 돌려주는 헬퍼, `server/tests/fixtures/`에 레코드 샘플(종목·루틴·세션·설정)
- [X] T017 [P] `server/tests/contract/auth.test.ts`: sync-api.md 계약 테스트 1~5(쿠키 없음 401, 해제된 기기 401, 코드 1회용, 만료 코드와 중복 `deviceId` 거부, `X-Fitness-Client` 없는 쓰기 403)
- [X] T018 [P] `server/tests/contract/sync.test.ts`: 계약 테스트 6~10, 12(네 종류 push→pull `seq` 순서, 낮은 version 무시, 같은 push 두 번은 `applied=0`, 검증 실패 시 전체 롤백(이름 0자·61자, `reps` 0·소수·1000, `weightKg` 음수·1001, `completed`인데 `endedAt` 없음, `endedAt < startedAt`, 알 수 없는 type), `limit` 페이지 나누기, 툼스톤 최소 필드)
- [X] T019 [P] `server/tests/contract/events.test.ts`: 계약 테스트 11(다른 클라이언트가 push하면 1초 안에 `cursor` 이벤트, 기기 해제 시 스트림 종료)
- [X] T020 [P] `server/tests/contract/admin-cli.test.ts`: admin-cli.md의 `pair`(이름이 비었거나 50자 초과면 종료 코드 2), `devices`, `revoke`(없는 ID는 1), `export`, `backup` 동작

### 서버 구현

- [X] T021 `server/src/db.ts`와 `server/src/migrations.ts`: `node:sqlite`(WAL) 연결, `PRAGMA user_version` 마이그레이션, 테이블 `records(type, id, version, deleted, body, seq UNIQUE, PRIMARY KEY(type,id))`, `devices`, `pair_codes` (data-model.md의 서버 SQLite 스키마). 대상 Node에서 `node:sqlite`가 플래그 없이 동작하는지 확인하고, 안 되면 plan.md Complexity Tracking에 `better-sqlite3` 사유를 기록한다 (research R3)
- [X] T022 `server/src/http.ts`: 라우팅, JSON 본문 1 MiB 제한(413), 오류 형식 `{"error","message","details"?}`, 모든 `/api/*` 응답에 `Cache-Control: no-store`, `X-Fitness-Client: 1` 검사(쓰기 403)
- [X] T023 `server/src/auth.ts`: 페어링 코드(혼동 문자 0/O, 1/I/L 제외 8자리, 10분 유효, 해시만 저장), `POST /api/pair`(실패 1분 5회 초과 시 429), 쿠키 `fitness_session`(`HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=315360000`, `FITNESS_DEV=1`이면 `Secure` 제외), 토큰은 SHA-256 해시만 저장, `last_seen_at` 갱신 (T017 통과)
- [X] T024 `server/src/sync.ts`: `POST /api/changes`(1~500개, 단일 트랜잭션, `shared/merge.ts`와 `validateRecord` 사용, `{applied, ignored, cursor}`)와 `GET /api/changes?since&limit`(기본·최대 1000, `hasMore`) (T018 통과)
- [X] T025 `server/src/events.ts`: `GET /api/events` SSE(`event: cursor`, 25초마다 `: ping`, 기기 해제 시 스트림 종료)와 `server/src/api.ts`의 `GET /api/health`, `GET /api/devices/me`, 그리고 `server/src/main.ts` 진입점(`HOST`, `PORT` 기본 8081, `FITNESS_DB`) (T019 통과)
- [X] T026 `server/src/admin-cli.ts`: `pair`, `devices`, `revoke`, `export`, `backup` 명령 (T020 통과). `shared/export.ts`에 내보내기 형식(`{"format":"fitness-export","version":1,...}`, 툼스톤·`version`·`updatedBy` 제외)을 함께 구현한다

### 클라이언트 기반

- [X] T027 [P] `client/tests/store.test.ts`(`fake-indexeddb`): 레코드 저장·읽기·삭제 표시, 트랜잭션 도중 실패 시 롤백, 업그레이드 경로, 첫 실행 시드 종목이 한 번만 들어감(고정 id), 시드 레코드는 최소 HLC `000000000000000-000000-seed`이고 dirty가 아님(push 대상 아님), 한 기기에서 시드 종목을 삭제(툼스톤)한 뒤 pull한 다른 기기의 시드가 그 삭제를 되살리지 못함(merge에서 시드가 짐)
- [X] T028 `client/src/store/db.ts`, `client/src/store/{exercises,routines,sessions,settings,meta}.ts`: IndexedDB object store `exercises`, `routines`, `sessions`(인덱스 `completedAt`, `status`), `settings`, `meta`(cursor, deviceId, dirty 표지), 쓰기 성공(트랜잭션 완료) 후에만 성공을 반환, 쓸 때마다 `shared/hlc.ts`로 새 `version` 발급과 dirty 표지, 첫 실행 시 `shared/seed-exercises.ts`를 최소 HLC `000000000000000-000000-seed`, dirty 아님으로 반영 (T027 통과)
- [X] T029 [P] `client/public/index.html`, `client/public/manifest.webmanifest`(`display: standalone`), 아이콘, `client/src/styles.css`(디자인 토큰, 라이트/다크 `prefers-color-scheme`, 터치 영역 최소 44px)
- [X] T030 `client/src/main.ts`, `client/src/app.ts`: 해시 라우터, 하단 탭 3개(루틴 / 기록 / 설정), 공통 로딩·빈·오류 상태 컴포넌트(`client/src/ui/states.ts`), `navigator.storage.persist()` 요청. 앱은 페어링 없이도 로컬 전용으로 완전히 동작해야 한다(research R10, 페어링 화면은 T055)
- [X] T031 [P] `client/src/sw.ts`: 앱 셸 캐시(`__BUILD_ID__`별 캐시 이름, 이전 캐시 정리), `/api/*`는 캐시하지 않음

**Checkpoint**: 공용 로직·서버·클라이언트 저장소가 동작한다. 사용자 스토리를 시작할 수 있다.

---

## Phase 3: User Story 1 - 루틴 만들기 및 관리 (Priority: P1) 🎯 MVP

**Goal**: 루틴을 만들고 종목 추가·순서 변경·삭제·목표 세트 설정, 수정·복제·삭제를 한다.

**Independent Test**: 루틴을 새로 만들고 종목 3개를 추가한 뒤 앱을 다시 열어도 루틴이 그대로 남아 있다.

### Tests for User Story 1 (먼저 작성, 실패 확인)

- [X] T032 [P] [US1] `client/tests/routines.test.ts`: 생성(이름 공백 제거 후 1~60자), 종목 추가·삭제·순서 변경(`items` 0~50개, `targetSets` 1~20), 복제(새 `id`, 이름 `"<원본> 복사"`가 60자 초과면 자름, `items` 깊은 복사, 원본 불변), 삭제 시 툼스톤
- [X] T033 [P] [US1] `e2e/us1-routines.spec.ts`: spec.md US1 인수 시나리오 1~4와 quickstart V1·V2(루틴 3종목 저장 후 새로고침해도 유지, 순서 변경·삭제 반영, 복제 독립, 삭제 후 목록에서 사라짐)와 잘못된 이름(빈 값·61자) 안내, 그리고 SC-002: 처음 실행(데이터 없음)에서 안내 없이 루틴 생성→세션 시작까지 3분 이내·화면 이동 5회 이내(루틴 목록 빈 상태의 "첫 루틴 만들기" 버튼 사용)

### Implementation for User Story 1

- [X] T034 [US1] `client/src/routines.ts`: 루틴 생성·수정·복제·삭제와 항목 조작 (T032 통과). 삭제된 종목을 가리키는 항목은 읽을 때 "삭제된 종목"으로 표시하고 세션 시작 시 건너뛴다
- [X] T035 [US1] `client/src/ui/routine-list.ts`: 루틴 목록 화면(빈 상태에 "첫 루틴 만들기" 버튼과 안내, 복제·삭제 메뉴, 삭제는 5초 이상 표시되는 되돌리기)
- [X] T036 [US1] `client/src/ui/routine-editor.ts`: 루틴 편집 화면(이름 입력, 종목 추가·삭제, 위/아래 순서 이동 버튼, 목표 세트 수 스테퍼, 입력 검증 메시지)
- [X] T037 [US1] `client/src/ui/exercise-picker.ts`: 종목 선택 화면(부위별 그룹, 이름 검색, 직접 종목 만들기(`custom: true`, 이름 1~60자, 부위 선택), 종목 이름 수정·삭제) — FR-003 (T033 통과)

**Checkpoint**: US1이 단독으로 동작한다. (MVP의 첫 조각)

---

## Phase 4: User Story 2 - 운동 세션 중 세트 기록 (Priority: P1)

**Goal**: 루틴 또는 빈 세션으로 시작해 세트의 무게·횟수를 기록하고 종료한다. 직전 값이 미리 채워진다.

**Independent Test**: 루틴으로 세션을 시작해 세트 여러 개를 기록하고 종료하면 세션이 저장되고 요약이 표시된다.

### Tests for User Story 2 (먼저 작성, 실패 확인)

- [X] T038 [P] [US2] `shared/tests/volume.test.ts`: `setVolume = weightKg × reps`(done인 세트만), `entryVolume`, `sessionVolume`, `completedSets`, `durationSec = endedAt − startedAt`, 맨몸(무게 0)은 볼륨 0이지만 완료 세트 수에는 포함
- [X] T039 [P] [US2] `shared/tests/prefill.test.ts`: 같은 종목의 가장 최근 완료(미삭제) 세션의 done 세트를 같은 번호 세트에 채움, 직전보다 세트가 많으면 마지막 세트 값 복사, 이력이 없으면 빈 값, 진행 중·삭제된 세션은 무시, 채운 세트는 `done=false`
- [X] T040 [P] [US2] `client/tests/sessions.test.ts`: 루틴으로 시작(항목마다 `exerciseName` 복사, `routineName` 복사), 빈 세션 시작 후 종목 추가, 세트 추가·수정·삭제·완료 토글, 입력 검증(`weightKg` 0 이상 1000 이하, `reps` 1 이상 999 이하 정수), 종료 시 `endedAt`·`status=completed`, 진행 중 세션은 동시에 최대 1개, 완료 세트 0개 종료는 확인 후 저장 또는 툼스톤 폐기
- [X] T041 [P] [US2] `e2e/us2-logging.spec.ts`: spec.md US2 인수 시나리오 1~4와 quickstart V3~V6, V10(직전 값 자동 채움 후 체크 한 번으로 세트 완료, 빈 세션 즉석 종목 추가, 잘못된 값 안내, 종료 요약에 운동 시간·완료 세트 수·총 볼륨, kg↔lb 전환 후 45 lb·100.25 lb 표시 유지), SC-001: 이전 기록이 있는 종목에서 한 세트 기록이 탭 2회 이내(미리 채운 값 확인 + 완료 체크)

### Implementation for User Story 2

- [X] T042 [P] [US2] `shared/volume.ts`를 구현한다 (T038 통과)
- [X] T043 [P] [US2] `shared/prefill.ts`를 구현한다 (T039 통과)
- [X] T044 [US2] `client/src/sessions.ts`: 세션 시작(루틴/빈)·종목 추가·세트 조작·종료·폐기. 입력할 때마다 즉시 IndexedDB 트랜잭션으로 저장하고 성공 후에만 화면에 반영, 진행 중 세션의 `startedBy`는 현재 `deviceId` (T040 통과). 직전 값은 `shared/prefill.ts`로 채운다
- [X] T045 [US2] `client/src/settings.ts`와 `client/src/ui/settings.ts`: 무게 단위 kg/lb 설정(기본 kg, 레코드 `id="settings"`), 입력·표시에 `shared/units.ts` 사용 (FR-012)
- [X] T046 [US2] `client/src/ui/session-screen.ts`: 세션 진행 화면 — 세트 행(무게 `inputmode="decimal"`, 횟수 `inputmode="numeric"`, 완료 체크), 세트 추가·삭제, 종목 추가, 경과 시간 표시, 한 손 조작용 큰 버튼, 검증 메시지 `aria-live`
- [X] T047 [US2] `client/src/ui/session-summary.ts`와 루틴 목록의 "세션 시작" 진입점, "빈 세션 시작" 진입점: 종료 요약 화면(운동 시간·완료 세트 수·총 볼륨, `shared/volume.ts` 재사용, 무게·볼륨은 설정 단위에 맞게 `shared/units.ts`의 `formatWeight`로 표시) (T041 통과)

**Checkpoint**: US1과 US2로 루틴 구성부터 기록까지 한 흐름이 동작한다.

---

## Phase 5: User Story 3 - 오프라인 보존과 홈서버 동기화 (Priority: P2)

**Goal**: 네트워크가 없어도 기록이 유실되지 않고, 연결되면 홈서버와 중복·누락 없이 동기화된다.

**Independent Test**: 오프라인에서 세션을 기록하고 새로고침해도 입력이 남아 있고, 온라인 복귀 후 다른 기기에 같은 기록이 보인다.

### Tests for User Story 3 (먼저 작성, 실패 확인)

- [X] T048 [P] [US3] `client/tests/sync-engine.test.ts`(`fake-indexeddb`, 가짜 서버): dirty 레코드 push(500개씩), pull 후 `merge`와 cursor 저장이 한 트랜잭션, 응답 유실 후 재전송해도 중복 없음, 서버 cursor가 저장값보다 작으면 모든 레코드를 dirty로 표시하고 cursor 0부터 push→pull, 오프라인이면 큐에 남고 오류를 내지 않음, 401이면 재연결 상태로 전환
- [X] T049 [P] [US3] `client/tests/session-restore.test.ts`: 앱 재시작 시 `status=active` 세션을 찾아 복원, 시작 후 12시간 초과 세션은 "이어하기/종료/폐기" 선택을 요구, `startedBy`가 다른 기기의 진행 중 세션은 읽기 전용이고 "다른 기기에서 진행 중"으로만 표시, 두 기기가 오프라인에서 각각 진행 중 세션을 만든 뒤 동기화해도 각 기기는 자기 세션만 이어하기로 보여 줌(기기당 1개 규칙)
- [X] T050 [P] [US3] `e2e/us3-offline.spec.ts`: spec.md US3 인수 시나리오와 quickstart V7·V8·V13(네트워크 차단 상태에서 세트 기록 오류 없음, 새로고침 후 진행 중 세션 복원, 복귀 후 두 번째 브라우저 컨텍스트에 중복·누락 없이 반영, 기기 해제 시 재연결 안내)

### Implementation for User Story 3

- [X] T051 [US3] `client/src/sync/engine.ts`: dirty push, `since` cursor pull, 멱등 재전송, 서버 복원 감지, 지수 백오프(최대 30초) (T048 통과)
- [X] T052 [P] [US3] `client/src/sync/events.ts`: `/api/events` SSE 구독, cursor가 커지면 pull, 끊긴 동안 30초 간격 pull, `visibilitychange`·`online`·앱 시작 시 즉시 동기화
- [X] T053 [P] [US3] `client/src/sync/status.ts`와 상단 상태 표시 `client/src/ui/sync-indicator.ts`: 동기화됨/대기 중/오프라인/재연결 필요, `aria-live` 안내
- [X] T054 [US3] `client/src/sessions.ts`와 `client/src/ui/resume-prompt.ts`: 앱 시작 시 진행 중 세션 복원과 이어하기/종료/폐기 선택 (T049 통과)
- [X] T055 [US3] `client/src/ui/pairing.ts`: 설정 화면에서 여는 선택형 페어링 코드 입력 화면(`POST /api/pair`, 클라이언트가 만든 `deviceId`), 연결 실패·잘못된 코드·만료 안내. 페어링하면 로컬에 쌓인 모든 레코드를 dirty로 표시해 서버로 올린다 (T050 통과)

**Checkpoint**: 오프라인 기록과 홈서버 동기화가 동작한다.

---

## Phase 6: User Story 4 - 과거 기록 조회 (Priority: P2)

**Goal**: 완료한 세션을 날짜순으로 보고, 상세에서 세트를 수정·삭제하며, 종목별 이력을 본다.

**Independent Test**: 세션 2개를 저장한 뒤 기록 화면에서 날짜순으로 보이고 상세가 입력값과 일치한다.

### Tests for User Story 4 (먼저 작성, 실패 확인)

- [X] T056 [P] [US4] `client/tests/history.test.ts`: 완료(미삭제) 세션 최신순 목록과 요약(날짜·루틴명·총 볼륨), 세션 수정이 요약에 반영, 종목 이력(해당 종목 done 세트를 날짜순), 삭제된 루틴으로 만든 세션은 당시 `routineName`으로 표시(FR-013), 세션 500개 기준 목록 조회가 1초 이내(SC-005)
- [X] T057 [P] [US4] `e2e/us4-history.spec.ts`: spec.md US4 인수 시나리오 1~3과 quickstart V9, 세션 삭제와 5초 이상 표시되는 되돌리기, 빈 상태 안내, lb 설정에서 목록·상세·종목 이력의 무게가 lb로 표시됨

### Implementation for User Story 4

- [X] T058 [US4] `client/src/history.ts`: `completedAt` 인덱스 커서로 최신순 목록, 세션 요약 계산(`shared/volume.ts`), 종목 이력 계산 (T056 통과)
- [X] T059 [US4] `client/src/ui/history-list.ts`: 기록 목록 화면(최신순, 날짜·루틴명·총 볼륨은 `formatWeight`로 설정 단위 표시, 빈 상태, 큰 목록은 점진 렌더링)
- [X] T060 [US4] `client/src/ui/session-detail.ts`: 세션 상세 화면(종목별 세트 표시, 세트 수정·삭제, 세션 삭제와 되돌리기, 수정 후 `version` 새로 발급, 무게는 `formatWeight`로 설정 단위 표시하고 수정 입력은 `toKg`로 변환)
- [X] T061 [US4] `client/src/ui/exercise-history.ts`: 종목 이력 화면(날짜순 세트 기록, 무게는 `formatWeight`로 설정 단위 표시), 세션 상세·종목 선택 화면에서 진입 (T057 통과)

**Checkpoint**: 네 스토리가 모두 독립적으로 동작한다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 데이터 소유권, 배포, 접근성, 성능 점검

- [X] T062 [P] `client/tests/export-erase.test.ts`: 내보내기 JSON이 `shared/export.ts` 형식과 같고 툼스톤·내부 필드가 빠짐, 전체 삭제가 모든 레코드를 `id`·`version`·`deleted`만 남은 툼스톤으로 바꾸고 push됨 (먼저 작성, 실패 확인)
- [X] T063 `client/src/export.ts`와 설정 화면(`client/src/ui/settings.ts`)에 "데이터 내보내기"(JSON 파일 내려받기)와 "모든 데이터 삭제"(확인 단계 필수) 추가 — FR-014, research R16 (T062 통과)
- [X] T064 [P] `e2e/export-erase.spec.ts`: quickstart V11·V12(내보내기와 `fitness-admin export` 결과 일치, 전체 삭제 후 서버 export가 비어 있음)
- [X] T065 [P] `e2e/a11y.spec.ts`: 모든 화면에 `@axe-core/playwright` 위반 0, 320px 폭에서 가로 스크롤 없음, 터치 영역 44px 이상, 동기화 상태·검증 오류가 `aria-live`로 안내됨 (quickstart V15, 헌법 I·IV)
- [X] T066 [P] `scripts/seed-sessions.mjs`: 세션 500개를 심는 시드 스크립트와 SC-005(1초 이내) 확인 절차를 quickstart 성능 확인 항목대로 연결
- [X] T067 [P] `deploy/Caddyfile`(`fitness.home.arpa`, `tls internal`, `/api/*` 프록시 `flush_interval -1`, 앱 셸 `no-cache`), `deploy/fitness.service`(전용 사용자 `fitness`, `StateDirectory=fitness`, `ProtectSystem=strict`, `Environment=PORT=8081`), `deploy/install.sh`(멱등, Node 24·Caddy·앱 파일·`fitness-admin` 명령 설치) — todo-app의 `deploy/` 참고, 같은 호스트에 둘 때 기존 Caddyfile에 사이트 블록만 추가하도록 안내
- [X] T068 quickstart.md 수동 검증 V1~V15와 배포 확인(홈서버 설치, 폰 홈 화면 설치, V3·V7·V8 반복)을 수행하고 결과를 기록한다
- [X] T069 `npm run lint`, `npm test`, `npm run test:e2e`가 모두 통과하는지 확인하고, 헌법 점검표(plan.md Constitution Check)를 구현 결과와 대조한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **로컬 전용 동작**: 앱은 페어링(T055) 없이도 US1·US2가 완전히 동작한다. E2E는 페어링 없이 실행하고, 동기화 테스트(US3)만 서버를 쓴다.
- **Setup (Phase 1)**: 의존 없음
- **Foundational (Phase 2)**: Setup 후. 모든 스토리를 막는다
- **US1 → US2**: US2는 루틴으로 세션을 시작하므로 US1의 `routines`가 필요하다(빈 세션 시작은 독립)
- **US3**: Foundational의 서버와 클라이언트 저장소에 의존하고 `client/src/sessions.ts`(T044)를 확장한다. US2 이후 진행
- **US4**: US2의 완료 세션 데이터에 의존한다. US3과는 독립이라 병렬 가능
- **Polish**: 원하는 스토리가 끝난 뒤

### Within Each Phase

- 테스트 작업을 먼저 작성하고 실패를 확인한 뒤 구현한다.
- 공용 로직(`shared/`) → 서버 / 클라이언트 저장소 → 도메인 로직 → UI → E2E 순서.
- `client/src/sessions.ts`는 T044와 T054가, `client/src/ui/settings.ts`는 T045와 T063이 같은 파일을 건드리므로 순서대로 진행한다.

### Parallel Opportunities

- Setup: T002~T006
- Foundational 테스트: T007~T010, T016~T020, T027 (서로 다른 파일)
- Foundational 구현: T011·T012·T014·T015, 서버(T021~T026)와 클라이언트(T027~T031)는 `shared/` 완료 후 병렬 진행 가능
- US2: T038~T041, T042·T043
- US3: T048~T050, T052·T053
- US4: T056·T057; US3와 US4는 서로 병렬 가능

### Parallel Example: Foundational 공용 로직

```text
Task: shared/tests/hlc.test.ts        (T007)
Task: shared/tests/merge.test.ts      (T008)
Task: shared/tests/model.test.ts      (T009)
Task: shared/tests/units.test.ts      (T010)
→ 모두 실패 확인 후
Task: shared/hlc.ts (T011), shared/merge.ts (T012), shared/units.ts (T014)  # 병렬
Task: shared/model.ts (T013)
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1(루틴) → Phase 4 US2(세트 기록). 여기서 멈추고 개발 서버에서 V1~V6, V10을 검증한다. 이 시점에 기기 안에서 쓸 수 있는 운동 기록 앱이 된다.
3. Phase 5 US3로 홈서버 동기화와 오프라인 복원을 더해 실사용 가능한 상태로 만든다(홈서버 배포는 T067).

### Incremental Delivery

- US1 → US2 → US3 → US4 → Polish 순으로 각 스토리를 끝낼 때마다 독립 검증·시연한다.
- 이후 기능 2(운동 GIF·3D 가이드)와 3(성장 차트)은 `exercise.id`/`bodyPart`와 `shared/volume.ts`를 재사용해 별도 스펙으로 진행한다.

## Notes

- [P] 작업은 서로 다른 파일을 건드린다.
- 각 작업 또는 논리적 묶음마다 커밋한다.
- 어느 체크포인트에서든 멈추고 해당 스토리를 독립적으로 검증할 수 있다.
