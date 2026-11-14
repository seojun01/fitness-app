# Tasks: 종목 선택 개편과 기본 종목 확장

**Tests**: 포함한다. 검증·필터·업그레이드·콘텐츠는 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다.

## Phase 1: Foundational (데이터)

- [X] T001 [P] `shared/tests/model.test.ts`: `exercise.equipment`(10개 값, 목록 밖 `enum`), `exercise.favorite`(불리언) 선택 필드, 이전 레코드 유효 (먼저 작성)
- [X] T002 `shared/model.ts`: `Equipment`, `EQUIPMENT` 목록, `Exercise.equipment?`·`favorite?`, 허용 키·검증 (T001 통과)
- [X] T003 [P] `shared/tests/muscle-groups.test.ts`: 그룹 12개가 근육 17종을 덮음(근육마다 정확히 한 그룹), `exerciseTags`(주동근→보조근, 중복 제거), 부위 기본값(직접 만든 종목) (먼저 작성)
- [X] T004 `shared/muscle-groups.ts` (T003 통과)
- [X] T005 [P] `shared/tests/seed.test.ts`·`guide-content.test.ts` 갱신: 기본 종목 91개, id 고유·접두어, 모두 장비 있음, 이름 고유, 모두 가이드 있음 (먼저 작성)
- [X] T006 `shared/seed-exercises.ts`(91개, 장비, `SEED_SET = 2`)와 `shared/guides.ts`(새 56개 가이드) (T005 통과)
- [X] T007 [P] `client/tests/store.test.ts`에 업그레이드: `seedSet` 1인 기기에서 새 종목 추가, 고치지 않은 기본 종목은 장비 반영, 이름 바꾼 기본 종목·지운 기본 종목은 그대로, 두 번 실행해도 같음 (먼저 작성)
- [X] T008 `client/src/store/records.ts` `ensureSeed` 세트 업그레이드 (T007 통과)
- [X] T009 `server/tests/contract/sync.test.ts`: `equipment`·`favorite`가 있는 종목 push·pull, 잘못된 값 400

## Phase 2: US1·US2·US3·US4 — 종목 선택 (P1·P2)

- [X] T010 [P] `client/tests/exercise-catalog.test.ts`: 사용 통계(완료 세션만), 분류 필터 5종(정렬 포함), 그룹·장비·검색 조합, 장비 기본값, 태그 최대 2개 표시 (먼저 작성)
- [X] T011 `client/src/exercise-catalog.ts`, `client/src/exercises.ts`(`toggleFavorite`, `createExercise`에 장비) (T010 통과)
- [X] T012 [P] `e2e/picker.spec.ts`: quickstart P1~P7·P9 (먼저 작성)
- [X] T013 `client/src/ui/exercise-picker.ts` 다시 작성: 전체 화면 대화상자, 뒤로·검색·새 종목, 세 줄 필터(토글 버튼 그룹), 커스텀 운동 추가, 목록(좋아요·이름·태그·선택·⋯), 하단 "+ N 운동 추가"·↺·맨 위로, ⋯ 메뉴(가이드·이력·이름 수정·삭제)
- [X] T014 `client/src/routines.ts` `appendExercises`(한도), `ui/routine-editor.ts`·`ui/routine-detail.ts`·`ui/session-screen.ts`에서 여러 개 추가와 한도 안내 (T012 통과)
- [X] T015 E2E 도우미·기존 테스트 갱신(`addExerciseByName`, 직접 만들기·이름 수정·가이드 경로)

## Phase 3: Polish

- [X] T016 `e2e/a11y.spec.ts`: 새 종목 선택 화면(필터·선택·커스텀 추가) 두 테마·320px
- [X] T017 새 가이드 56개 문구 검토
- [X] T018 `npm run lint`·`npm test`·`npm run test:e2e` 전체 통과, quickstart 검증 기록
