# Tasks: 운동 가이드 (텍스트)

**Input**: Design documents from `/specs/002-exercise-guide/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sync-api-delta.md, quickstart.md

**Tests**: 포함한다. 검증·콘텐츠 무결성은 **테스트를 먼저 쓰고 실패를 확인한 뒤** 구현한다.

> **2026-11-14 범위 축소**: 동작 애니메이션·3D·근육 지도를 빼고 텍스트 가이드만 남겼다. 이전 작업 목록(T001~T055, 그중 13개 완료)은 이 목록으로 대체한다. 이전 완료분 중 빌드의 지연 로딩 청크·서비스 워커 사전 캐시는 그대로 쓰고, 인체 모델·렌더러 코드는 T001에서 지운다.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (정리)

- [X] T001 인체 모델 코드 제거: `shared/body/{skeleton,pose,camera,props}.ts`, `shared/tests/{skeleton,pose,camera}.test.ts`, `client/src/ui/guide/renderer.ts`, `client/tests/renderer.test.ts` 삭제. `shared/body/muscles.ts` → `shared/muscles.ts`로 옮기고 뼈 구간(`segments`)·`face`를 뺀 근육 17종(`MuscleId`, `MUSCLES`의 한국어 이름, `isMuscleId`)만 남긴다. `shared/tests/muscles.test.ts`를 그에 맞게 줄인다. `npm run lint`·`npm test` 통과 확인

---

## Phase 2: Foundational (노트 레코드·저장소·동기화)

- [X] T002 [P] `shared/tests/model.test.ts`에 `guideNote` 검증 추가(먼저 작성): `cues`·`mistakes` 0~10개·항목 공백 제거 후 1~200자(코드 포인트), 근육은 목록 안·중복 없음·각 0~6개, 주동근·보조근 겹침 `overlap`, 기본 종목 id `builtin_exercise`, 알 수 없는 필드 거부, 툼스톤은 공통 필드만으로 통과
- [X] T003 [P] `server/tests/contract/guide-note.test.ts`: contracts/sync-api-delta.md 계약 테스트 1~5 (먼저 작성)
- [X] T004 `shared/model.ts`: `RecordType`에 `'guideNote'`, `GuideNote` 타입, 검증 규칙, 상수(`NOTE_ITEMS_MAX = 10`, `NOTE_ITEM_MAX = 200`, `NOTE_MUSCLES_MAX = 6`) (T002 통과)
- [X] T005 `shared/export.ts`(내보내기 `version: 2`, `guideNotes`)와 `server/src/admin-cli.ts` export (T003 통과)
- [X] T006 [P] `client/tests/guide-notes.test.ts`(`fake-indexeddb`): 노트 저장·수정, 모두 비우면 툼스톤, 기본 종목 거부, IndexedDB v1(기능 1·3 스키마)로 만든 DB를 v2로 열면 기존 레코드 유지 + `guideNotes` store 생성 + cursor 0, 동기화 엔진이 `guideNote`를 push·pull, 내보내기에 노트 포함·전체 삭제 시 툼스톤 (먼저 작성)
- [X] T007 `client/src/store/db.ts`(DB_VERSION 2, `guideNotes` store + `byDirty`, v1→v2에서 meta `cursor` 0), `client/src/store/records.ts`(노트 읽기·dirty·`saveRecords`), `client/src/sync/engine.ts`(`STORE_OF.guideNote`), `client/src/export.ts`(노트 내보내기·전체 삭제)

**Checkpoint**: 노트가 저장·동기화·내보내기·전체 삭제된다.

---

## Phase 3: User Story 1 - 운동 중 ⓘ로 종목 가이드 보기 (Priority: P1) 🎯 MVP

- [X] T008 [P] [US1] `shared/tests/guide-content.test.ts`(먼저 작성): `SEED_EXERCISES` 35개 전부 기본 가이드 1개, 요점 3~5개·실수 2~4개·각 1~200자, 주동근 1~3개·보조근 0~4개·목록 안의 값·겹침 없음·중복 없음, 기본 가이드가 없는 id는 `undefined`
- [X] T009 [P] [US1] `e2e/guide-us1-session.spec.ts`(먼저 작성): quickstart G1·G2 — 진행 화면에서 세트 입력 후 "벤치 프레스 가이드"(ⓘ) → 대화상자(이름=종목 이름)에 "자세 요점"·"흔한 실수"·"주요 자극 근육"(주동근/보조근 글)·안전 안내 → 닫기/Esc 후 입력값·휴식 타이머 유지, 직접 만든 종목은 "아직 가이드가 없어요"와 "가이드 작성"
- [X] T010 [US1] `shared/guides.ts`: 기본 종목 35개의 요점·실수·주동근·보조근(research G11 원칙), `getBuiltinGuide(id)`, `listBuiltinGuides()` (T008 통과)
- [X] T011 [US1] `client/src/guides.ts`: `loadGuides()`(`import('../../shared/guides.ts')` 지연 로딩, 한 번만), `resolveGuide(db, exerciseId)` → `builtin | note | none`
- [X] T012 [US1] `client/src/ui/guide-view.ts`: 가이드 본문(요점·실수 목록, "주동근: …"·"보조근: …" 글, 안전 안내, 로딩·오류 상태, `none`이면 "아직 가이드가 없어요"와 직접 만든 종목일 때 "가이드 작성" 링크), `client/src/ui/guide-sheet.ts`: `openGuideSheet(ctx, exerciseId)` — `<dialog>`(이름=종목 이름), 닫기·Esc, 다른 대화상자 위에 쌓여도 동작
- [X] T013 [US1] `client/src/ui/session-screen.ts`: 종목 이름 옆 ⓘ 버튼(`aria-label` = `${종목} 가이드`) — 진행 화면을 다시 그리지 않고 시트로 연다 (T009 통과)

---

## Phase 4: User Story 2 - 종목을 고를 때 가이드 보기 (Priority: P2)

- [X] T014 [P] [US2] `e2e/guide-us2-picker.spec.ts`(먼저 작성): quickstart G3 — 종목 선택에서 "벤치 프레스 가이드" → 시트 → 닫기 → 종목 선택이 열린 채로 벤치 프레스를 고를 수 있음
- [X] T015 [US2] `client/src/ui/exercise-picker.ts`: 종목 행의 "이력" 옆에 "가이드" 버튼(`aria-label` = `${종목} 가이드`), 시트를 종목 선택 위에 연다 (T014 통과)

---

## Phase 5: User Story 3 - 가이드 탭 (Priority: P2)

- [X] T016 [P] [US3] `client/tests/guide-list.test.ts`(먼저 작성): `listGuideEntries(db, { bodyPart?, query? })` — 삭제된 종목 제외, 부위 필터, 이름 부분 일치(공백·대소문자 무시), 이름을 바꾼 기본 종목도 가이드 유지, 직접 만든 종목은 노트 유무, 각 항목에 주동근 요약
- [X] T017 [P] [US3] `e2e/guide-us3-tab.spec.ts`(먼저 작성): quickstart G4·G5 — 하단 탭 "가이드", 부위 필터, 검색, 항목을 누르면 `#/guides/:id` 전체 화면(뒤로 링크), "루틴에 추가" → 루틴 선택 → 그 루틴 끝에 추가, 기본 종목 이름 변경 후에도 가이드 유지
- [X] T018 [US3] `client/src/guides.ts`에 `listGuideEntries` (T016 통과)
- [X] T019 [US3] `client/src/app.ts` 하단 탭 4개(루틴·기록·가이드·설정), `Screen.tab`에 `'guides'`
- [X] T020 [US3] `client/src/ui/guide-list.ts`(`#/guides`: 부위 필터 select, 검색 입력 "가이드 검색", 결과 목록, 빈 결과), `client/src/ui/guide-screen.ts`(`#/guides/:exerciseId`, 제목=종목 이름, 뒤로), `guide-view`에 "루틴에 추가"(루틴 선택 대화상자, 루틴이 없으면 "새 루틴 만들기" 안내, `appendExercise` 재사용, 토스트), `routes.ts` (T017 통과)

---

## Phase 6: User Story 4 - 직접 만든 종목에 가이드 글 쓰기 (Priority: P2)

- [X] T021 [P] [US4] `e2e/guide-us4-notes.spec.ts`(먼저 작성): quickstart G6·G7 — "가이드 작성" → 요점 2개·실수 1개·주동근 저장 → 다시 열면 그대로, 모두 비우면 "아직 가이드가 없어요", 겹치는 근육·201자 안내 후 저장 안 됨, 기본 종목에는 작성 버튼 없음, 두 기기(페어링)에서 노트 동기화(서버 export로 업로드 확인 후 두 번째 기기)
- [X] T022 [US4] `client/src/guides.ts`: `saveGuideNote(ctx, exerciseId, { cues, mistakes, primaryMuscles, secondaryMuscles })`(빈 항목 제거·공백 정리, 모두 비면 툼스톤, 기본 종목 거부), `resolveGuide`의 `note` (T006 통과)
- [X] T023 [US4] `client/src/ui/guide-note-editor.ts`와 `routes.ts`(`#/guides/:exerciseId/edit`): 요점·실수 목록 편집(줄마다 하나, 라벨 있는 textarea), 주동근·보조근 체크박스 그룹, 검증 메시지 `role="alert"`, 저장·취소, `guide-view`에서 직접 만든 종목일 때만 "가이드 작성/수정" (T021 통과)

---

## Phase 7: Polish

- [X] T024 [P] `e2e/a11y.spec.ts` 확장: 가이드 탭·가이드 화면·가이드 시트·노트 편집을 어두운·밝은 테마에서 axe 위반 0, 320px 가로 스크롤 없음, 조작 44px 이상
- [X] T025 [P] `e2e/guide-offline-export.spec.ts`: quickstart G8·G9 — 앱을 한 번 연 뒤 오프라인에서 처음 여는 종목의 가이드가 보임(사전 캐시), 내보내기 v2에 노트 포함, 전체 삭제 후 노트 없음, v1 DB로 만든 브라우저에서 새 버전을 열면 기존 기록 유지
- [X] T026 기본 가이드 35개 문구를 한 번씩 읽어 검토(사실관계·초보자 눈높이·의학적 단정 없음)하고 고친다
- [X] T027 quickstart "검증 기록", `npm run lint`·`npm test`·`npm run test:e2e` 전체 통과, plan.md 헌법 점검표 대조

---

## Dependencies & Execution Order

- T001 → T002~T007 → US1(T008~T013) → US2·US3·US4(서로 병렬 가능) → Polish
- 같은 파일: `guide-view.ts`는 T012 → T020 → T023 순서, `guides.ts`는 T011 → T018 → T022 순서, `routes.ts`는 T020 → T023 순서로 진행한다.

## Implementation Strategy

- **MVP**: T001~T013(운동 중 ⓘ로 텍스트 가이드)
- 이어서 US2(종목 선택), US3(가이드 탭), US4(노트), Polish 순서로 진행한다.
