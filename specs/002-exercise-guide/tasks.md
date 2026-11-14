# Tasks: 운동 가이드 (부위별 동작 애니메이션)

**Input**: Design documents from `/specs/002-exercise-guide/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sync-api-delta.md, contracts/guide-content.md, quickstart.md

**Tests**: 포함한다. 헌법의 개발 워크플로와 research G10에 따라 **테스트를 먼저 작성하고 실패를 확인한 뒤** 구현한다. 가장 중요한 테스트는 가이드 콘텐츠 무결성(35개 전부)이다.

**Organization**: 사용자 스토리 US1(가이드 보기)·US2(운동 중 열기)·US3(둘러보기)·US4(직접 만든 종목 노트)별로 묶는다.

> **2026-11-14 기능 3 영향**: 기능 3(운동 흐름 개편)이 진행 화면을 "한 종목씩" 구조로 다시 만들었다. T026의 "종목 카드 머리의 가이드 버튼"은 새 진행 화면의 종목 이름 옆(⋯ 메뉴 또는 별도 버튼)에 둔다. 또한 사용자가 플리크 화면을 검토하며 "근육 지도와 동작 그림은 필요 없다"고 했으므로, 이 기능의 동작 애니메이션(US1의 플레이어·템플릿·35개 동작)을 계속할지 **재개 전에 사용자에게 확인해야 한다**. 텍스트 가이드(요점·실수·근육)와 직접 만든 종목의 노트(US4)는 그 결정과 무관하게 쓸 수 있다.

> **2026-11-14 범위 변경**: 3D 보기(spec의 이전 US5)를 뺐다. 이전 Phase 7(T044~T047)은 삭제했고, canvas를 못 쓸 때의 대체(이전 T047 일부)는 US1의 T022·T017로 옮겼다. 번호는 다시 매기지 않았다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 서로 다른 파일이고 미완료 작업에 의존하지 않아 병렬 실행 가능
- 경로는 저장소 루트 기준. 기존 기능 1 코드(`shared/`, `server/`, `client/`)를 확장한다.
- 모든 UI 출력은 `textContent`로만 한다(`innerHTML` 금지). 런타임 의존성을 추가하지 않는다.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 지연 로딩 청크와 서비스 워커 사전 캐시 (research G5)

- [X] T001 `scripts/build.mjs`를 수정한다: 앱 본체 빌드에 `splitting: true`, `format: 'esm'`, `chunkNames: 'chunks/[name]-[hash]'`, `metafile: true`를 켜고, 결과 파일 목록(`client/dist` 안의 `.map`을 뺀 모든 `.js`·`.css`와 `/`·`manifest`·아이콘)을 서비스 워커 빌드에 `define: { __PRECACHE__: JSON.stringify(list) }`로 넣는다
- [X] T002 `client/src/sw.ts`의 고정 `SHELL` 목록을 `__PRECACHE__`로 바꾼다(설치 시 가이드 청크까지 캐시). `declare const __PRECACHE__: string[]` 추가
- [X] T003 [P] `shared/body/`, `shared/guides/`, `client/src/ui/guide/` 디렉터리를 만들고, `scripts/lint.mjs`의 검사 경로가 새 디렉터리를 포함하는지 확인한다(이미 `shared`·`client/src` 전체를 걷는다)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 인체 모델·투영·근육 정의 — 모든 스토리가 이 위에 그린다

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 스토리 작업을 시작하지 않는다.

### 테스트 (먼저 작성, 실패 확인)

- [X] T004 [P] `shared/tests/skeleton.test.ts`: 관절 17개(골반·허리·가슴·목·머리, 좌우 어깨·팔꿈치·손목, 좌우 고관절·무릎·발목) 계층이 트리이고 루트가 골반, 기본 서 있는 자세에서 머리 꼭대기 y≈1.0·발목 y≈0.04, 관절 가동 범위가 정의됨(무릎 flex 0~150, 팔꿈치 flex 0~150, 어깨 flex −60~180 등 contracts/guide-content.md)
- [X] T005 [P] `shared/tests/pose.test.ts`: `solve(pose)`가 어떤 관절 회전에서도 모든 뼈 길이를 유지(오차 1e-9), 무릎 flex 90°에서 정강이가 허벅지에 수직, `poseAt(motion, t)`의 경계(t=0은 첫 포즈, t→1은 첫 포즈로 돌아옴, 키프레임 사이 sine in-out 이징, t를 주기로 반복), 구간별 템포(내리기 2 : 올리기 1) 반영
- [X] T006 [P] `shared/tests/camera.test.ts`: `front`·`side`·`back` 직교 투영의 축 대응(오른손 좌표계, y 위, z 정면), 깊이는 카메라에 가까운 점이 더 작음, yaw 회전 90°가 `side`와 같음, 화면 좌표가 지정한 캔버스 크기 안에 들어가도록 맞춤(fit)
- [X] T007 [P] `shared/tests/muscles.test.ts`: 근육 17종(`pectorals`·`lats`·`traps`·`rhomboids`·`frontDelts`·`sideDelts`·`rearDelts`·`biceps`·`triceps`·`forearms`·`abs`·`obliques`·`erectors`·`glutes`·`quads`·`hamstrings`·`calves`)이 모두 한국어 이름과 강조할 뼈 구간·면(앞/뒤)을 가지고, bodyPart(가슴·등·어깨·하체·팔·코어·유산소·기타)별 대표 강조 근육이 정의됨

### 구현

- [X] T008 [P] `shared/body/skeleton.ts`: `JointId`, 관절 계층·뼈 길이(키 1.0 정규화)·기본 방향·가동 범위 (T004 통과)
- [X] T009 `shared/body/pose.ts`: `Pose`·`Motion`·`Keyframe` 타입, `solve(pose)`(FK → 관절 월드 좌표), `poseAt(motion, t)`(보간·이징·템포) (T005 통과)
- [X] T010 [P] `shared/body/camera.ts`: `Camera = { yaw, pitch, distance }`(직교 투영만), 프리셋 `front`·`side`·`back`·`top45`, `project(points, camera, viewport)` → 화면 좌표·깊이 (T006 통과)
- [X] T011 [P] `shared/body/muscles.ts`: `MuscleId`, `MUSCLES`(한국어 이름·뼈 구간·면), `BODY_PART_MUSCLES` (T007 통과)
- [X] T012 [P] `shared/body/props.ts`: 기구 `barbell`·`dumbbells`·`bench`·`inclineBench`·`pullupBar`·`cable`·`floor`·`box`·`rope`·`bike`·`rower`의 형상(선분 목록)과 손·발 부착 규칙
- [X] T013 `client/src/ui/guide/renderer.ts`: `drawBody(ctx2d, joints, camera, { highlight: {primary, secondary}, props, size, dpr })` — 뼈를 둥근 굵은 선분으로, 관절 원·머리 원, 깊이 순(뒤→앞) 정렬, 주동근 진한 강조·보조근 옅은 강조, 라이트/다크 토큰 색(`getComputedStyle`로 CSS 변수 읽기), devicePixelRatio 대응. `client/tests/renderer.test.ts`로 가짜 2D 컨텍스트를 써서 선분 개수·그리기 순서(깊이)·강조 색 적용을 검증한다(먼저 작성)

**Checkpoint**: 정지 포즈 하나를 원하는 시점에서 canvas에 그릴 수 있다.

---

## Phase 3: User Story 1 - 종목 가이드 보기 (Priority: P1) 🎯 MVP

**Goal**: 기본 종목 35개 모두 반복 동작 애니메이션 + 자세 요점·흔한 실수·주요 자극 근육.

**Independent Test**: 스쿼트 가이드를 열어 애니메이션이 반복 재생되고 세 텍스트 항목이 보인다.

### Tests for User Story 1 (먼저 작성, 실패 확인)

- [ ] T014 [P] [US1] `shared/tests/templates.test.ts`: 동작 템플릿 약 12개(수평 누르기·수직 누르기·플라이·수직 당기기·수평 당기기·스쿼트·힌지·런지·무릎 굽힘폄·팔꿈치 굽힘·팔꿈치 폄·레이즈·코어·주기 동작)가 각각 매개변수 조합에서 키프레임 ≥ 2, `t`가 0에서 1까지 엄격 증가, 첫 포즈 = 마지막 포즈인 `Motion`을 만듦
- [ ] T015 [P] [US1] `shared/tests/guide-content.test.ts`: contracts/guide-content.md "콘텐츠 무결성 규칙" 1~7을 그대로 검사 — `SEED_EXERCISES` 35개 전부 가이드 1개, 요점 3~5개·실수 2~4개·각 1~200자, 주동근 1~3개·보조근 0~4개·목록 안의 값·겹침 없음, 키프레임 규칙, 100단계 샘플이 관절 가동 범위 안, `standing` 동작의 발목 y ≥ 0, 모든 샘플에서 뼈 길이 불변, `alt` 비어 있지 않음
- [ ] T016 [P] [US1] `client/tests/player.test.ts`: 플레이어 상태 기계 — 시작 시 재생(동작 줄이기면 정지 + `poster` 자세), 일시정지·재생 토글, 속도 0.5배·1배가 진행 시간에 반영, 숨김(`visibilitychange`)·해제(`destroy`) 시 프레임 요청 중단. 시계와 `requestAnimationFrame`은 주입한 가짜를 쓴다
- [ ] T017 [P] [US1] `e2e/guide-us1-view.spec.ts`: spec US1 인수 시나리오 1~4와 quickstart G1~G3 — `#/guides/<스쿼트 id>`에서 canvas(`role="img"`, 대체 텍스트 있음)가 보이고 프레임이 바뀜(두 시점 스크린숏 비교), "자세 요점"·"흔한 실수"·"주요 자극 근육"(주동근/보조근 글 구분) 표시, 일시정지 버튼 `aria-pressed`, 속도 0.5배, `page.emulateMedia({ reducedMotion: 'reduce' })`에서 자동 재생 안 함, "통증이 있으면 멈추고 전문가와 상의하세요" 안내

### Implementation for User Story 1

- [ ] T018 [US1] `shared/guides/templates.ts`: T014의 템플릿들 (T014 통과). 표현이 어려운 동작은 템플릿 안에서 키프레임을 직접 정의한다
- [ ] T019 [US1] `shared/guides/content.ts`와 `shared/guides/index.ts`: 기본 종목 35개의 요점·실수·주동근·보조근·`alt`·템플릿 매개변수·`standing` 표시, `listBuiltinGuides()`·`getBuiltinGuide(id)` (T015 통과). 문구는 일반적인 근력 운동 지도 상식에 기반하고 의학적 단정을 피한다
- [ ] T020 [US1] `client/src/ui/guide/player.ts`: rAF 재생 루프, 일시정지·재생, 속도, 동작 줄이기(`matchMedia('(prefers-reduced-motion: reduce)')`), 숨김·해제 시 정지, 2D 고정 시점(가이드의 `view`) (T016 통과)
- [ ] T021 [US1] `client/src/guides.ts`: `loadGuides()`가 `import('../../shared/guides/index.ts')`로 지연 로딩, `resolveGuide(db, exercise)` → `builtin | note | none` (data-model "합쳐진 가이드". `note`는 US4에서 채우므로 이 단계에서는 `builtin | none`)
- [ ] T022 [US1] `client/src/ui/guide/guide-view.ts`: 가이드 본문 컴포넌트 — 플레이어 canvas(`role="img"`, `aria-label`=`alt`), 재생/일시정지(`aria-pressed`)·속도 버튼, "자세 요점"·"흔한 실수" 목록, "주요 자극 근육"(주동근·보조근을 글로 구분), 안전 안내 문구, 로딩·오류 상태, canvas 2D 컨텍스트를 얻지 못하면 그림 대신 `alt` 문단과 "이 기기에서는 동작 그림을 표시할 수 없어요" 안내(FR-009). `none`이면 부위 강조 정지 그림과 "아직 가이드가 없어요"
- [ ] T023 [US1] `client/src/ui/guide-screen.ts`와 `client/src/routes.ts`: 전체 화면 라우트 `#/guides/:exerciseId`(제목 = 종목 이름, 탭 강조 = 가이드), 화면을 떠날 때 플레이어 해제. 기록 상세(`client/src/ui/session-detail.ts`)와 종목 이력(`client/src/ui/exercise-history.ts`)에도 "가이드" 링크를 둔다(research G8) (T017 통과)

**Checkpoint**: 주소로 직접 들어가면 모든 기본 종목의 가이드를 볼 수 있다.

---

## Phase 4: User Story 2 - 운동 중·루틴 편집 중 바로 가이드 열기 (Priority: P1)

**Goal**: 세션 화면과 종목 선택에서 시트로 가이드를 열고, 닫으면 원래 상태 그대로.

**Independent Test**: 세션 중 세트 값을 입력하고 가이드를 열었다 닫으면 입력 값·경과 시간·스크롤이 그대로다.

### Tests for User Story 2 (먼저 작성, 실패 확인)

- [ ] T024 [P] [US2] `e2e/guide-us2-entry.spec.ts`: spec US2 인수 시나리오 1~3과 quickstart G4·G5 — 세션 화면에서 무게·횟수 입력 후 "벤치 프레스 가이드" → 시트(`role="dialog"`, 이름 = 종목 이름) → "닫기" 후 입력 값·스크롤 위치 유지, 탭 2회 이내(SC-001), Esc로도 닫힘. 종목 선택 대화상자에서 "벤치 프레스 가이드" → 닫기 → 종목 선택이 그대로 열려 있고 종목을 고를 수 있음. 가이드가 없는 직접 만든 종목은 "아직 가이드가 없어요"가 보임

### Implementation for User Story 2

- [ ] T025 [US2] `client/src/ui/guide/guide-sheet.ts`: `openGuideSheet(ctx, exerciseId)` — `<dialog>`(`aria-labelledby` = 종목 이름)에 `guide-view`를 넣고 `showModal()`, 닫기 버튼·Esc로 닫으면 플레이어 해제 후 제거, 다른 대화상자 위에 쌓여도 동작
- [ ] T026 [US2] `client/src/ui/session-screen.ts`: 종목 카드 머리에 "가이드" 버튼(`aria-label` = `${종목 이름} 가이드`) 추가, `openGuideSheet` 호출 — 세션 화면은 다시 그리지 않는다
- [ ] T027 [US2] `client/src/ui/exercise-picker.ts`: 종목 행에 "가이드" 버튼(`aria-label` = `${종목 이름} 가이드`) 추가, 시트를 종목 선택 위에 연다 (T024 통과)

**Checkpoint**: US1·US2로 핵심 가치(운동 중 바른 자세 확인)가 완성된다.

---

## Phase 5: User Story 3 - 부위별로 가이드 둘러보기 (Priority: P2)

**Goal**: 가이드 탭에서 부위 필터·검색, 정지 미리보기, 루틴에 추가.

**Independent Test**: "하체"를 고르면 하체 종목만 보이고 하나를 열 수 있다.

### Tests for User Story 3 (먼저 작성, 실패 확인)

- [ ] T028 [P] [US3] `client/tests/guide-list.test.ts`: 목록 데이터 함수 `listGuideEntries(db, { bodyPart?, query? })` — 삭제된 종목 제외, 부위 필터, 이름 부분 일치(대소문자·공백 무시), 기본 종목은 이름을 바꿔도 가이드가 남음(FR-014), 직접 만든 종목은 노트 유무 표시
- [ ] T029 [P] [US3] `e2e/guide-us3-browse.spec.ts`: spec US3 인수 시나리오 1~3과 quickstart G6·G7·G13 — 하단 탭 "가이드", 부위 필터 "하체", 검색 "스쿼트", 항목마다 정지 미리보기 canvas, 가이드에서 "루틴에 추가" → 루틴 선택 → 그 루틴에 종목 추가 확인, 기본 종목 이름 변경 후에도 가이드 유지

### Implementation for User Story 3

- [ ] T030 [US3] `client/src/guides.ts`에 `listGuideEntries` 추가 (T028 통과)
- [ ] T031 [US3] `client/src/app.ts`: 하단 탭 4개(루틴·기록·가이드·설정)와 `Screen.tab`에 `'guides'` 추가
- [ ] T032 [US3] `client/src/ui/guide-list.ts`와 `client/src/routes.ts`: `#/guides` — 부위 필터(라디오 버튼 그룹, 44px), 검색 입력("가이드 검색"), 항목마다 `poster` 자세 정지 미리보기(작은 canvas, `aria-hidden`, 화면에 보일 때만 그림), 빈 결과 상태
- [ ] T033 [US3] `client/src/ui/guide/guide-view.ts`에 "루틴에 추가" — 루틴 선택 대화상자(루틴이 없으면 "새 루틴 만들기" 안내), `routines.ts`의 `addItem`/`updateRoutine` 재사용, 완료 토스트 (T029 통과)

**Checkpoint**: 가이드 탭으로 계획 단계에서 종목을 익힐 수 있다.

---

## Phase 6: User Story 4 - 직접 만든 종목에 가이드 글 쓰기 (Priority: P2)

**Goal**: 직접 만든 종목에 요점·실수·근육을 쓰고 기기 간 동기화.

**Independent Test**: 노트를 저장하고 다시 열면 그대로, 다른 기기에서도 보인다.

### Tests for User Story 4 (먼저 작성, 실패 확인)

- [ ] T034 [P] [US4] `shared/tests/model.test.ts`에 `guideNote` 검증 추가: `cues`·`mistakes` 각 0~10개, 항목 공백 제거 후 1~200자(코드 포인트), 근육은 목록 안의 값·중복 없음·각 0~6개, 주동근·보조근 겹침 금지(`overlap`), **기본 종목 id 거부(`builtin_exercise`)**, 알 수 없는 필드 거부, 툼스톤은 공통 필드만으로 통과
- [ ] T035 [P] [US4] `server/tests/contract/guide-note.test.ts`: contracts/sync-api-delta.md 계약 테스트 1~5 (export `version: 2` 포함)
- [ ] T036 [P] [US4] `client/tests/guide-notes.test.ts`(`fake-indexeddb`): 노트 저장·수정, 모두 비우면 툼스톤, 기본 종목에는 저장 거부, `resolveGuide`가 `note`를 돌려줌, 종목 삭제 시 숨김·되돌리면 다시 보임, IndexedDB v1 DB(기능 1 스키마로 만든 DB)를 v2로 열면 기존 레코드가 남고 `guideNotes` store가 생기며 cursor가 0이 됨, 동기화 엔진이 `guideNote`를 push·pull함(fake server)
- [ ] T037 [P] [US4] `e2e/guide-us4-notes.spec.ts`: spec US4 인수 시나리오 1~4와 quickstart G8~G10 — 직접 만든 종목 "가이드 작성" → 요점 2개·실수 1개·주동근 선택 저장 → 다시 열면 그대로, 모두 비우면 "아직 가이드가 없어요", 두 기기(페어링)에서 노트가 보임, 기본 종목에는 "가이드 작성"이 없음, 201자 항목은 안내 후 저장 안 됨

### Implementation for User Story 4

- [ ] T038 [US4] `shared/model.ts`: `RecordType`에 `'guideNote'`, `GuideNote` 타입, `validateRecord` 규칙(기본 종목 id 목록은 `shared/seed-exercises.ts`에서 가져옴) (T034 통과)
- [ ] T039 [US4] `shared/export.ts`: 내보내기 `version: 2`, `guideNotes` 배열(툼스톤·내부 필드 제외), `server/src/admin-cli.ts` export에 `guideNotes` 포함 (T035 통과)
- [ ] T040 [US4] `client/src/store/db.ts`(DB_VERSION 2, `guideNotes` store + `byDirty`, v1→v2에서 meta `cursor`를 0으로), `client/src/store/records.ts`(노트 읽기·dirty 목록·`saveRecords`에 `guideNotes`), `client/src/sync/engine.ts`(`STORE_OF.guideNote`)
- [ ] T041 [US4] `client/src/guides.ts`: `saveGuideNote(ctx, exerciseId, { cues, mistakes, primaryMuscles, secondaryMuscles })`(빈 항목 제거·공백 정리, 모두 비면 툼스톤, 기본 종목이면 거부), `resolveGuide`의 `note` 분기 (T036 통과)
- [ ] T042 [US4] `client/src/export.ts`: 내보내기에 노트 포함, 전체 삭제 시 모든 노트 툼스톤 (FR-016)
- [ ] T043 [US4] `client/src/ui/guide-note-editor.ts`와 `client/src/routes.ts`(`#/guides/:exerciseId/edit`): 요점·실수 목록 편집(항목 추가·삭제, 각 입력에 라벨), 근육 선택(주동근·보조근 체크박스 그룹, 겹치면 안내), 검증 메시지 `role="alert"`, 저장·취소. `guide-view`에서 직접 만든 종목일 때만 "가이드 작성/수정" 버튼 (T037 통과)

**Checkpoint**: 직접 만든 종목도 가이드 글을 갖고, 기록처럼 동기화·내보내기·삭제된다.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T048 [P] `e2e/a11y.spec.ts` 확장: 가이드 목록·가이드 화면·가이드 시트·노트 편집에서 axe 위반 0, 320px 가로 스크롤 없음, 조작 버튼 44px 이상, 근육 강조가 글로도 제공됨 (quickstart G16)
- [ ] T049 [P] `e2e/guide-offline.spec.ts`: 앱을 한 번 열고(서비스 워커 사전 캐시 완료) 오프라인으로 전환한 뒤, 처음 여는 종목의 가이드 글과 동작이 보임 (quickstart G12, FR-010, SC-002)
- [ ] T050 [P] `e2e/guide-export.spec.ts`: 노트 작성 → 내보내기 파일이 `version: 2`이고 `guideNotes` 포함, `fitness-admin export`와 일치, 전체 삭제 후 노트가 앱·서버에서 사라짐 (quickstart G14)
- [ ] T051 [P] `e2e/guide-upgrade.spec.ts`: 기능 1 스키마(IndexedDB v1)로 루틴·세션을 심은 브라우저에서 새 버전을 열면 기록이 그대로 있고 노트를 쓸 수 있음 (quickstart G15)
- [ ] T052 [P] `e2e/guide-perf.spec.ts`: 가이드를 연 뒤 첫 프레임까지 1초 이내(SC-002), 5초 재생 동안 프레임 간격의 95번째 백분위가 50ms 이하(SC-005, 모바일 뷰포트 프로젝트. 헤드리스 환경의 일시적 지연 한두 번에 흔들리지 않도록 백분위로 잰다)
- [ ] T053 `specs/002-exercise-guide/checklists/motion-review.md`: 35개 동작 육안 검토 체크리스트(종목마다 "그 종목처럼 보임 / 관절 이상 없음 / 기구 위치 적절" 칸)를 만들고, `npm run dev`로 직접 검토해 결과를 기록한다. 이상한 동작은 `shared/guides/content.ts` 매개변수 수정으로 고친다
- [ ] T054 quickstart.md G1~G16을 수행하고 "검증 기록" 섹션에 자동/수동 결과와 미확인 항목을 기록한다
- [ ] T055 `npm run lint`, `npm test`, `npm run test:e2e` 전체 통과 확인, 초기 번들(`client/dist/main.js`) 크기가 기능 1 대비 크게 늘지 않았는지(가이드 데이터가 별도 청크인지) 확인, plan.md 헌법 점검표 대조

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → 스토리들
- **US1**은 Foundational에 의존한다(템플릿·콘텐츠·플레이어·가이드 화면).
- **US2**는 US1의 `guide-view`에 의존한다(시트에 넣을 컴포넌트).
- **US3**은 US1에 의존하고, US2와는 독립이라 병렬 가능하다.
- **US4**는 US1의 `guide-view`·`resolveGuide`에 의존하고, US2·US3과 독립이다. 서버·저장소·동기화 변경은 이 단계에서만 생긴다.
- **Polish**는 해당 스토리 이후에 진행한다.

### Within Each Phase

- 테스트 작성 → 실패 확인 → 구현 순서다.
- 같은 파일을 여러 작업이 건드리면 순서대로 진행한다.
  - `guide-view.ts`: T022 → T033 → T043
  - `guides.ts`: T021 → T030 → T041
  - `routes.ts`: T023 → T032 → T043

### Parallel Opportunities

- Foundational 테스트: T004~T007. 구현: T008·T010·T011·T012
- US1 테스트: T014~T017
- US3·US4는 US1이 끝나면 서로 병렬로 진행할 수 있다(위 같은 파일 순서만 지킨다).
- Polish: T048~T052

### Parallel Example: Foundational

```text
Task: shared/tests/skeleton.test.ts (T004)
Task: shared/tests/pose.test.ts     (T005)
Task: shared/tests/camera.test.ts   (T006)
Task: shared/tests/muscles.test.ts  (T007)
→ 실패 확인 후
Task: shared/body/skeleton.ts (T008), camera.ts (T010), muscles.ts (T011), props.ts (T012)  # 병렬
Task: shared/body/pose.ts (T009)  # skeleton 다음
```

---

## Implementation Strategy

### MVP First (US1 + US2)

1. Setup → Foundational
2. US1(가이드 보기) → US2(운동 중 시트로 열기). 여기서 멈추고 G1~G5를 검증한다. 운동 중 바른 자세 확인이라는 핵심 가치가 이 시점에 완성된다.
3. 가장 큰 작업은 T018·T019(템플릿과 35개 콘텐츠)다. 테스트(T014·T015)로 구조 오류를 잡고, 그럴듯함은 T053에서 사람이 본다.

### Incremental Delivery

- US1 → US2 → US3 → US4 → Polish 순서다. 각 스토리가 끝날 때마다 독립적으로 검증한다.
- 이후 기능 3(성장 차트)은 `shared/volume.ts`와 기록 데이터를 재사용해 별도 스펙으로 진행한다.

## Notes

- [P] 작업은 서로 다른 파일을 건드린다.
- 각 작업 또는 논리적 묶음마다 커밋한다.
- 어느 체크포인트에서든 멈추고 해당 스토리를 독립적으로 검증할 수 있다.
