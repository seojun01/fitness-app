# Tasks: 성장 차트·통계

**Input**: `specs/004-growth-stats/` (plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md)

**Tests**: 포함한다. 헌법 IV가 지표 계산에 단위 테스트를 요구하므로 `shared/growth.ts`는 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다. 화면은 contracts/ui.md의 이름으로 E2E를 쓴다.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [ ] T001 `client/src/app.ts`: `Screen.tab` 에 `'stats'` 추가, `TABS` 를 루틴·기록·**통계**·가이드·설정 5개로 (href `#/stats`). `client/src/styles.css` 탭 5개가 320px 에서 한 줄(탭당 ≥44px 높이)
- [ ] T002 [P] `client/src/stats-period.ts`: `readPeriod(): Period`, `savePeriod(p)` — `localStorage['fitness.statsPeriod']`, 값 `'4w' | '3m' | '1y' | 'all'`, 깨진 값·저장소 오류면 `'4w'` (research S3)

## Phase 2: Foundational (공유 계산, 모든 스토리의 전제)

- [ ] T003 `shared/stats.ts`: 내부 `completed` 를 `completedSessions(sessions)` 로 export (동작 그대로, 기존 테스트 통과)
- [ ] T004 `shared/tests/growth.test.ts` 기초부(먼저): `dayKey(iso)` 기기 현지 날짜(자정 직전·직후, TZ=Asia/Seoul 고정), `periodRange` — 4주=오늘 포함 28일, 3개월·1년=달력 기준(말일 처리 예: 5/31 → 3개월 전 다음 날), 'all'=첫 완료 세션부터·기록 없으면 null, `previousRange` 같은 일수·바로 앞. 완료 세션 판정(진행 중·삭제·endedAt 없음 제외), 완료 세트 판정(`done && weightKg!==null && reps!==null`)
- [ ] T005 `shared/growth.ts` 기초부: `Period`, `DayKey`, `Range`, `dayKey`, `periodRange`, `previousRange`, 범위 포함 판정(`startedAt` 현지 날짜) (T004 통과)

**Checkpoint**: 기간·날짜 규칙이 테스트로 고정됨

## Phase 3: US1 — 종목별 성장 차트와 PR (P1) 🎯 MVP

**Goal**: 종목 차트 화면에서 지표별 추이(선 차트)와 개인 최고 기록 4종을 본다.

**Independent Test**: 같은 종목을 60·65·70kg로 서로 다른 날 기록 → `#/stats/exercise/:id` 에 점 3개, PR 최고 무게 "70kg · 마지막 날짜".

- [ ] T006 [US1] `shared/tests/growth.test.ts` 추이·PR(먼저): `exerciseSeries` — 세션당 점 1개·날짜순, 같은 세션 중복 종목 합침, 완료 세트 없는 세션은 점 없음, e1rm=세트별 `estimate1rm` 최대(소수 1자리), 볼륨·총 횟수·최다 횟수, 기간 밖 제외, 60점 초과 → 주별 묶기(지표별 주 최대, `grouped=true`, sets 빈 배열), `bodyweightLike`(기간 안 무게 모두 0). `personalRecords` — 전체 기간, 동률이면 먼저 달성한 날, 기록 없으면 null, sessionReps. 진행 화면 `exerciseRecords` 와 best1rm·maxWeight 일치
- [ ] T007 [US1] `shared/growth.ts`: `exerciseSeries`, `personalRecords`, `exercisesByRecency` (T006 통과)
- [ ] T008 [P] [US1] `client/src/ui/charts.ts`: `lineChart({ points:{x:label,y:number}[], yLabel, format, summary, onSelect })` — SVG `role=img` + `aria-label`=summary, y 눈금 2~3개 글자, 점 고르기 group "점 고르기"(tabindex 0, ←/→, Home/End), 터치·클릭은 가장 가까운 x, 고른 점 강조(크기+외곽선, 색만 아님); `dataTable(caption, headers, rows)` 를 `<details><summary>표로 보기</summary><table>`; `createElementNS` 만 사용(innerHTML 금지). 색은 CSS 토큰. 구현 전 dataviz 가이드 확인
- [ ] T009 [US1] `client/src/ui/exercise-chart-view.ts`: `renderExerciseChart(container, { ctx, exerciseId, sessions, exercises, unit, period })` — 기간 radiogroup "기간"(공유 기억), 지표 radiogroup "지표"(추정 1RM·최고 무게·세션 볼륨 / 맨몸: 세션 총 횟수·최다 횟수), 선 차트, status 영역 "11월 3일 · 추정 1RM 87.5kg · 80kg×5, …", 표로 보기, region "개인 최고 기록"(값·달성 날짜, 날짜는 그 세션 상세 링크), 안내(0개 "아직 기록이 없어요", 1개 "기록이 쌓이면 추이가 보여요", 묶음 "기록이 많아 주별 최고값으로 보여요"), 무게는 설정 단위, 삭제된 종목 이름은 마지막 기록 이름 + "삭제된 종목"
- [ ] T010 [US1] `client/src/ui/exercise-chart.ts` + `client/src/routes.ts`: `#/stats/exercise/:id` 화면(tab 'stats', back), 세션·종목 한 번 읽기
- [ ] T011 [P] [US1] `e2e/stats.spec.ts` US1: 세 번 기록 → 점 3개(표 행 3개), 지표 바꾸기, ←/→ 로 status 글 바뀜, PR 4종 날짜, 맨몸 종목 지표 이름, 기록 1개·0개 안내, lb 전환 시 단위

**Checkpoint**: 종목 차트 단독으로 동작 (MVP)

## Phase 4: US2 — 기간 요약과 주별 추이 (P1)

**Goal**: 통계 탭에서 기간을 고르면 요약·증감·주별 막대를 본다.

**Independent Test**: 이번 주 2회·지난주 1회 → "4주"에서 "운동 3회", 막대 마지막 두 개 1·2.

- [ ] T012 [US2] `shared/tests/growth.test.ts` 요약·막대(먼저): `summarizeRange`(세션 수, 볼륨=완료 세트 무게×횟수, 시간=endedAt−startedAt·음수 0), 증감 = 현재−이전, `buckets` — 월요일 시작, 기간과 겹치는 모든 주 0 포함, 기간 밖 날 제외, `range.days > 371` 이면 월별, label `M/D`·`YY.M`
- [ ] T013 [US2] `shared/growth.ts`: `summarizeRange`, `buckets` (T012 통과)
- [ ] T014 [P] [US2] `client/src/ui/charts.ts`: `columnChart({ items:{label,value}[], format, summary })` — 라벨 간격 자동 생략(320px), 0 막대는 바닥선 표시, 표로 보기
- [ ] T015 [US2] `client/src/ui/stats-screen.ts` + `routes.ts` `#/stats`: radiogroup "기간", region "기간 요약"(운동 N회·총 볼륨·운동 시간 "H시간 M분", 증감은 ▲/▼ + 글 "지난 기간보다 2회 늘었어요", 'all' 은 증감 없음), region "주별 운동"/"월별 운동"(차트 2개: 운동 횟수·볼륨), 빈 상태 "운동을 기록하면 여기에 통계가 쌓여요". 기간 변경은 다시 읽지 않고 재계산
- [ ] T016 [P] [US2] `e2e/stats.spec.ts` US2: 요약 숫자·막대 표 값, 기간 바꾸면 기억(새로고침 후 유지), 빈 상태

## Phase 5: US3 — 부위별 비중 (P2)

**Independent Test**: 가슴 6세트·하체 3세트 → 가슴 67%·하체 33%, 나머지 0세트 아래.

- [ ] T017 [US3] `shared/tests/growth.test.ts`(먼저): `bodyPartShare` — 8부위 모두, 세트 수 내림차순·동률은 BODY_PARTS 순서·0세트 맨 아래, ratio(전체 0이면 0), 볼륨, 종목 맵에 없는 종목은 other, exerciseIds 세트 수 내림차순
- [ ] T018 [US3] `shared/growth.ts`: `bodyPartShare` (T017 통과)
- [ ] T019 [US3] `client/src/ui/stats-screen.ts`: region "부위별 비중" — 부위마다 가로 막대 + button "가슴 6세트 67%"(aria-expanded), 펼치면 그 부위 종목 list, 항목 link "<종목> 차트"(`#/stats/exercise/:id`); 막대 길이 외에 숫자 글로 표시
- [ ] T020 [P] [US3] `e2e/stats.spec.ts` US3: 비중 숫자·순서, 부위 펼치기 → 종목 차트 이동

## Phase 6: US4 — 운동 달력 (P2)

**Independent Test**: 이번 달 3일·10일 기록 → 두 날 표시, 3일 누르면 세션 상세.

- [ ] T021 [US4] `shared/tests/growth.test.ts`(먼저): `calendarMonth` — 월요일 시작 격자(5·6주), 앞뒤 달 `inMonth=false`·세션 미포함, sessionIds 시작 순, activeDays, 윤년 2월
- [ ] T022 [US4] `shared/growth.ts`: `calendarMonth` (T021 통과)
- [ ] T023 [US4] `client/src/ui/stats-screen.ts`: region "운동 달력" — button "이전 달"/"다음 달", heading "YYYY년 M월", "이번 달 운동 N일", 7열 격자(요일 머리 월~일), 운동한 날 = 색 + 점(•) + button "M월 D일, 운동 N회", 안 한 날은 비활성 텍스트; 누르면 1개 → `#/history/:id`, 여럿 → `#/stats/day/:day`. 보던 달은 화면 안에서만 유지
- [ ] T024 [US4] `client/src/ui/stats-day.ts` + `routes.ts` `#/stats/day/:day`: 그날 세션 카드 목록(기록 목록과 같은 카드), 잘못된 날짜·세션 없음 빈 상태
- [ ] T025 [P] [US4] `e2e/stats.spec.ts` US4: 운동한 날 표시·일수, 달 이동, 하루 1개·2개 이동

## Phase 7: US5 — 다른 화면에서 종목 차트로 (P2)

**Independent Test**: 진행 화면 "기록" → "차트 보기" → 대화상자, 닫으면 입력값·휴식 타이머 그대로.

- [ ] T026 [US5] `client/src/ui/exercise-chart.ts`: `openExerciseChartDialog(ctx, exerciseId)` — 전체 화면 dialog "<종목> 차트", button "닫기"·Esc, 본문은 `renderExerciseChart`(T009) 재사용, 닫으면 포커스 복귀
- [ ] T027 [US5] `client/src/ui/session-screen.ts` "기록" 펼침에 button "차트 보기"(대화상자), `client/src/ui/session-detail.ts` 종목 카드에 link "<종목> 차트", `client/src/ui/exercise-history.ts` 에 link "차트 보기"
- [ ] T028 [US5] `client/src/ui/stats-screen.ts`: 종목 찾기 — searchbox "종목 차트 찾기", list "기록이 있는 종목"(`exercisesByRecency`, 최근 순, 검색은 이름 부분 일치), 항목 link "<종목> 차트"
- [ ] T029 [P] [US5] `e2e/stats.spec.ts` US5: 진행 화면 탭 2회로 차트(SC-003), 닫은 뒤 입력값·타이머 유지, 세션 상세·종목 이력 링크, 종목 찾기 검색

## Phase 8: Polish & Cross-Cutting

- [ ] T030 [P] `e2e/a11y.spec.ts`: 통계 탭(데이터 있음·없음), 종목 차트, 차트 대화상자, 그날 목록 — 두 테마·320px axe 0건, 탭 5개 320px 한 줄
- [ ] T031 [P] 성능(SC-001): `scripts/seed-sessions.mjs` 500세션을 받은 기기에서 통계 탭·종목 차트 첫 표시 1초 이내 확인(E2E 측정 또는 quickstart 기록)
- [ ] T032 오프라인(FR-012): 서버 없이 통계 탭·종목 차트 표시 E2E (`context.setOffline(true)`)
- [ ] T033 `npm run lint`·`npm test`·`npm run test:e2e` 전체 통과, quickstart 확인 결과 기록

## Dependencies

- Phase 1·2 → 모든 스토리. T003 → T004/T005.
- US1(T006~T011)이 MVP. US2·US3·US4는 US1과 독립(공유 계산만 의존)이지만 `stats-screen.ts` 를 함께 고치므로 T015 → T019 → T023 → T028 순서.
- US5는 US1(T009 렌더러)과 US2(T015 화면, 종목 찾기 위치)에 의존.
- `charts.ts`: T008(선) → T014(막대) 순서(같은 파일).

## Parallel Opportunities

- T002 ∥ T001
- T008(차트 함수) ∥ T006·T007(계산)
- 각 스토리의 E2E(T011, T016, T020, T025, T029)는 해당 구현과 다른 파일이라 먼저 써 둘 수 있다
- T030 ∥ T031

## Implementation Strategy

1. Setup + Foundational → US1(종목 차트) → 확인(MVP).
2. US2(대시보드) → US3 → US4 → US5 순서로 `stats-screen.ts` 에 섹션을 하나씩 추가하며 각각 E2E로 확인.
3. Polish: 접근성·성능·오프라인 → 전체 테스트.
