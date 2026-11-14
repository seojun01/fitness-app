# Tasks: 운동 흐름 개편

**Input**: Design documents from `/specs/003-workout-flow-redesign/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/record-fields.md, quickstart.md

**Tests**: 포함한다. 헌법의 개발 워크플로에 따라 계산·타이머·검증은 **테스트를 먼저 쓰고 실패를 확인한 뒤** 구현한다. 구조가 바뀌는 기존 E2E는 같은 스토리 안에서 고친다.

## Format: `[ID] [P?] [Story] Description`

- 경로는 저장소 루트 기준. 기능 1 코드를 확장·수정한다. 출력은 `textContent`로만 하고 런타임 의존성을 추가하지 않는다.

---

## Phase 1: Setup

- [X] T001 [P] `specs/003-workout-flow-redesign/` 문서가 있고 `.specify/feature.json`이 이 기능을 가리키는지 확인한다(이미 생성됨)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 레코드 필드 추가와 앱 셸 옵션 — 여러 스토리가 쓴다

- [X] T002 [P] `shared/tests/model.test.ts`에 추가(먼저 작성): `exercise.memo` 선택·문자열·0~500자(코드 포인트, 501자 `length`), `settings.restSeconds` 선택·정수·15~600·15의 배수(10·601·50·"60" 거부 `range`), 두 필드가 없는 레코드도 통과
- [X] T003 [P] `server/tests/contract/sync.test.ts`에 contracts/record-fields.md 계약 테스트 1~3 추가(먼저 작성)
- [X] T004 `shared/model.ts`: `Exercise.memo?`, `Settings.restSeconds?`, 허용 키·검증 규칙, 상수 `MEMO_MAX = 500`, `REST_MIN = 15`, `REST_MAX = 600`, `REST_STEP = 15`, `REST_DEFAULT = 60` (T002·T003 통과)
- [X] T005 `client/src/app.ts`: `Screen.back?: string`(상단 왼쪽 "‹" 링크, `aria-label="뒤로"`), `Screen.focus?: boolean`(하단 탭 숨김, `body`에 `data-focus` 표시), 화면 전환 시 원래대로 복원. 해시만 바뀌고 같은 화면을 유지하고 싶을 때를 위해 `Screen.onRoute?(params): boolean`(true면 다시 만들지 않음)

**Checkpoint**: 새 필드가 저장·동기화되고, 화면이 뒤로 링크·집중 모드를 쓸 수 있다.

---

## Phase 3: User Story 1 - 한 종목씩 넘기며 운동하기 (Priority: P1) 🎯 MVP

**Goal**: 진행 화면을 한 종목 단위로, 진행 점·다음 운동·세트 조작·모든 세트 완료·종목 추가/삭제.

**Independent Test**: 종목 3개 루틴에서 첫 종목 완료 → 다음 운동 → 진행 점으로 돌아와 값 유지.

### Tests (먼저 작성)

- [X] T006 [P] [US1] `client/tests/sessions.test.ts`에 추가: `completeAllSets(ctx, sessionId, entryId)`가 값이 있는 세트만 완료하고 `{ completed, skippedEmpty }` 반환, `removeLastSet`이 마지막 세트를 지우고 세트가 0개면 아무것도 안 함, `addEntry` 후 새 항목이 맨 뒤
- [X] T007 [P] [US1] `e2e/flow-us1-pages.spec.ts`: spec US1 시나리오 1~6과 quickstart F1~F5 — 진행 점(`role="tablist"` 아님, `nav[aria-label="종목 진행"]` 안의 버튼, `aria-current="step"`), 하단 탭 숨김, "다음 운동" → 두 번째 종목, 진행 점으로 첫 종목 복귀 시 값 유지, 마지막 종목 "운동 완료" → 요약, 세트 추가/삭제/⋯ 삭제, 모든 세트 완료(빈 세트 안내), "+" 종목 추가 후 그 종목으로 이동, ⋯ → "이 종목 삭제" 후 앞 종목으로 이동, 종목 0개 세션의 빈 상태

### Implementation

- [X] T008 [US1] `client/src/sessions.ts`: `completeAllSets`, `removeLastSet` (T006 통과)
- [X] T009 [US1] `client/src/ui/session-screen.ts` 다시 작성: 상단(‹ 루틴으로, 경과 시간, 진행 점, "+" 종목 추가, "종료"=`세션 종료`), 종목 영역(이름, ⋯ 메뉴: 이 종목 삭제, 세트 표: 세트·무게(단위)·횟수·완료·⋯, "세트 추가"(`<종목> 세트 추가`), "세트 삭제", "모든 세트 완료", "다음 운동"/"운동 완료"), `#/session/:index` 라우팅과 `onRoute`로 종목 영역만 다시 그림, 마지막 위치 `localStorage` 저장. 기존 입력 검증·저장 대기열·맨몸 0kg 규칙은 그대로 옮긴다
- [X] T010 [US1] `client/src/routes.ts`에 `#/session/:index` 추가, `client/src/styles.css`에 진행 점·하단 고정 영역·세트 표 스타일 (T007 통과)
- [X] T011 [US1] 기존 E2E 수정: `e2e/us2-logging.spec.ts`, `e2e/us3-offline.spec.ts`, `e2e/export-erase.spec.ts`, `e2e/a11y.spec.ts`의 진행 화면 조작(여러 종목 → "다음 운동", 세트 삭제 버튼 이름 등)을 새 구조에 맞춘다. 시나리오의 의도는 바꾸지 않는다

**Checkpoint**: 한 종목씩 기록하는 흐름이 동작하고 기능 1 시나리오가 모두 통과한다.

---

## Phase 4: User Story 2 - 휴식 타이머 (Priority: P1)

### Tests (먼저 작성)

- [X] T012 [P] [US2] `client/tests/rest-timer.test.ts`(가짜 시계·가짜 저장소): `start(base)` → 남은 시간이 시각 기준으로 줄어듦, `pause`/`resume`, `stop` → idle, 진행 중 ±15초가 `endsAt`을 옮김(0 이하면 done), idle에서 ±15초가 base를 15~600 안에서 바꿈, 0이 되면 `done`과 `onDone` 한 번만 호출, 저장소에서 복원(새로고침)해도 남은 시간 오차 1초 이내, 깨진 저장값은 idle
- [X] T013 [P] [US2] `e2e/flow-us2-rest-timer.spec.ts`: quickstart F6~F9 — `page.clock`으로 시간 제어, 세트 완료 후 "휴식 시간" 영역이 60초부터 감소, −/+·⏸/▶·■, 새로고침·종목 이동 후 이어짐, 0초에 "휴식 끝"(`role="status"`), 멈춘 상태에서 + 두 번 → 설정의 기본 휴식 시간 90초로 저장

### Implementation

- [X] T014 [US2] `client/src/rest-timer.ts`: 상태 기계(data-model 전이도), `localStorage` 키 `fitness.restTimer`(읽기·쓰기 try/catch), 시계·저장소 주입 (T012 통과)
- [X] T015 [P] [US2] `client/src/feedback.ts`: `vibrate([200,100,200])`(없으면 무시) — 나중에 네이티브 햅틱으로 바꿀 자리
- [X] T016 [US2] `client/src/settings.ts`에 `getRestSeconds`/`setRestSeconds`(Settings.restSeconds, 기본 60)
- [X] T017 [US2] `client/src/ui/rest-timer-bar.ts`: 하단 고정 바("휴식 시간", 큰 남은 시간, −·+·▶/⏸·■, 각 버튼 접근 이름, 250ms 갱신, 끝나면 "휴식 끝" `role="status"` + 진동), `session-screen.ts`에서 세트 완료(켤 때)에 `start`, 세션 종료 시 `stop` (T013 통과)

**Checkpoint**: 세트 완료 → 휴식 → 다음 세트 흐름이 끊김 없이 돈다.

---

## Phase 5: User Story 3 - 지난번 대비와 종목 기록 (Priority: P2)

### Tests (먼저 작성)

- [X] T018 [P] [US3] `shared/tests/stats.test.ts`: data-model "계산값" 표의 함수 전부 — `previousTotals`(현재 세션 제외, 삭제·진행 중 세션 제외, 같은 세션 안 여러 항목 합산), `entryTotals`, `compare`(볼륨/횟수 선택, up/down/same/first), `estimate1rm`(r=1, w=0), `exerciseRecords`(1RM 최고 소수 첫째 자리, 최고 무게, 누적 볼륨, 최다·누적 횟수, 최근 2개), `relativeDay`(오늘·어제·N일 전·30일 이상 날짜, 시간대 경계), `lastPerformed`, `routineBodyParts`(순서·중복 제거·삭제 종목 제외)
- [X] T019 [P] [US3] `e2e/flow-us3-compare.spec.ts`: quickstart F10·F11 — 첫 세션 "첫 기록이에요", 두 번째 세션에서 세트 완료마다 "볼륨 600kg ▼480kg" 갱신, 넘으면 ▲, 맨몸 종목은 "횟수", "기록" 펼치면 추정 1RM·최고 무게·누적 볼륨과 최근 기록 날짜·세트, lb 설정에서 lb 표시

### Implementation

- [X] T020 [US3] `shared/stats.ts` (T018 통과)
- [X] T021 [US3] `session-screen.ts`: 종목 이름 아래 대비 줄(시각 표기 + 화면 낭독기용 문장), 접는 "기록" 영역(현재 기록 3칸 + 최근 기록), 진행 화면을 열 때 완료 세션 목록을 한 번 읽어 계산 (T019 통과)

---

## Phase 6: User Story 4 - 종목 메모 (Priority: P2)

### Tests (먼저 작성)

- [X] T022 [P] [US4] `client/tests/exercises.test.ts`(또는 routines.test.ts에 추가): `setExerciseMemo`가 공백 정리 없이 저장(줄바꿈 유지), 501자 거부, 새 version·dirty, 기본 종목 메모 저장 시 시드 버전에서 실제 버전으로 바뀜(동기화 대상)
- [X] T023 [P] [US4] `e2e/flow-us4-memo.spec.ts`: quickstart F12 — 메모 입력 후 다음 세션에서 유지, 두 기기(페어링)에서 동기화, 501자 안내

### Implementation

- [X] T024 [US4] `client/src/exercises.ts`: `setExerciseMemo` (T022 통과)
- [X] T025 [US4] `session-screen.ts`: 접는 "메모" 영역(라벨 있는 textarea, 400ms 디바운스 저장, 떠날 때 즉시 저장, 글자 수 표시, 초과 안내) (T023 통과)

---

## Phase 7: User Story 5 - 루틴 화면 개편 (Priority: P2)

### Tests (먼저 작성)

- [X] T026 [P] [US5] `client/tests/routines.test.ts`에 추가: `listRoutineCards(db, sort)`가 부위 요약·마지막 수행일을 붙이고, `recent` 정렬(기록 없는 루틴은 뒤, 만든 순서)과 `name` 정렬(한국어)을 지킴, `appendExercise(ctx, routineId, exerciseId)`가 맨 뒤에 추가
- [X] T027 [P] [US5] `e2e/flow-us5-routines.spec.ts`: quickstart F13 — 카드의 부위("가슴, 팔")·"기록 없음" → 운동 후 "오늘", 카드 누르면 상세(뒤로 링크), 상세의 시작·운동 추가, 카드 ⋯ → 편집/복제/삭제, 시작 아이콘으로 바로 시작, 정렬 바꾸기, 하단 "자유운동"·"+ 추가"

### Implementation

- [X] T028 [US5] `client/src/routines.ts`: `listRoutineCards`, `appendExercise` (T026 통과)
- [X] T029 [US5] `client/src/ui/routine-list.ts` 다시 작성: "내 루틴" 제목, 정렬 선택(최근·이름), 카드(시작 아이콘 버튼 `<이름> 시작`, 이름, 부위(초록), 마지막 수행일, ⋯ 메뉴 `<이름> 더보기` → 편집·복제·삭제), 진행 중 세션 배너·다른 기기 진행 중 카드 유지, 하단 고정 "자유운동"·"+ 추가"
- [X] T030 [US5] `client/src/ui/routine-detail.ts`와 `routes.ts`: `#/routines/:id`(상세, `back`), 편집은 `#/routines/:id/edit`로 이동, 종목 목록(이름·부위·목표 세트), 하단 고정 "시작"·"운동 추가", 상단 ⋯(편집·복제·삭제)
- [X] T031 [US5] 기존 E2E 수정: `e2e/helpers.ts`(`createRoutineViaUi`가 "+ 추가" 사용, 편집 진입은 카드 → 상세 → 편집), `e2e/us1-routines.spec.ts`의 편집·복제·삭제 경로를 새 화면에 맞춘다 (T027 통과)

---

## Phase 8: User Story 6 - 어두운 화면 (Priority: P3)

- [X] T032 [P] [US6] `client/tests/theme.test.ts`: 저장값 없음 → `dark`, `light`/`system` 적용(`data-theme` 속성 설정·제거), 저장소 예외에도 기본값
- [X] T033 [US6] `client/src/theme.ts`, `client/public/index.html`의 첫 화면 전 적용 스크립트, `client/src/styles.css` 토큰 재구성(`:root[data-theme=dark]` 기본, `[data-theme=light]`, 속성 없으면 시스템), 플리크풍 색(배경 #0f0f10, 카드 #1c1c1e, 강조 주황빨강, 부위 초록)과 대비 4.5:1 이상
- [X] T034 [US6] `client/src/ui/settings.ts`에 "화면 테마"(어둡게·밝게·시스템 설정 따르기 라디오), `e2e/flow-us6-theme.spec.ts`(기본 어두움, 바꾸면 즉시·새로고침 후 유지) (T032 통과)

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T035 [P] `e2e/a11y.spec.ts` 확장: 루틴 상세·새 진행 화면(기록·메모 펼침, 휴식 타이머 진행 중)·설정을 **어두운·밝은 테마 모두**에서 axe 위반 0, 320px 가로 스크롤 없음, 조작 44px 이상 (SC-006)
- [X] T036 [P] 기능 2(가이드) 문서와의 정합성: 이 기능이 진행 화면을 다시 만들었으므로 `specs/002-exercise-guide/tasks.md`의 진행 화면 진입(T026) 설명에 "새 진행 화면의 종목 ⋯ 메뉴 또는 종목 이름 옆"을 반영하고, 근육 지도·동작 그림 제외 결정이 기능 2 범위에 미치는 영향을 기능 2 문서에 메모로 남긴다
- [X] T037 quickstart.md F1~F14를 자동/수동으로 확인하고 "검증 기록"을 남긴다
- [X] T038 `npm run lint`, `npm test`, `npm run test:e2e` 전체 통과, plan.md 헌법 점검표 대조

---

## Dependencies & Execution Order

- Setup → Foundational(T002~T005) → US1 → US2 → (US3, US4, US5, US6 병렬 가능) → Polish
- US2·US3·US4는 `session-screen.ts`를 함께 고치므로 **T009 → T017 → T021 → T025** 순서로 진행한다.
- US5는 진행 화면과 독립이다(`routine-list.ts`, `routine-detail.ts`). US6은 CSS 토큰을 고치므로 다른 스토리의 스타일 작업 후에 하는 것이 충돌이 적다.

### Parallel Opportunities

- T002·T003, T006·T007, T012·T013·T015, T018·T019, T022·T023, T026·T027, T032, T035·T036

## Implementation Strategy

- **MVP**: US1 + US2(한 종목씩 + 휴식 타이머)까지 하면 운동 중 체감이 가장 크게 바뀐다.
- 이어서 US3·US4(진행 화면 정보), US5(메인·상세), US6(테마) 순서로 진행하고, 스토리마다 E2E로 검증한다.
