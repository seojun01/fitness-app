# Data Model: 운동 가이드 (텍스트)

**Feature**: `002-exercise-guide` | **근거**: [spec.md](./spec.md), [research.md](./research.md) G4'·G6·G7

공통 타입과 동기화 필드는 [기능 1 data-model](../001-routine-workout-logging/data-model.md)을 따른다.

## Muscle (고정 목록, `shared/muscles.ts`)

`MuscleId` = `"pectorals" | "lats" | "traps" | "rhomboids" | "frontDelts" | "sideDelts" | "rearDelts" | "biceps" | "triceps" | "forearms" | "abs" | "obliques" | "erectors" | "glutes" | "quads" | "hamstrings" | "calves"` (한국어 이름 포함)

## BuiltinGuide (앱 내장, 읽기 전용, 동기화 안 함, `shared/guides.ts`)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `exerciseId` | Uuid | 기본 종목 id. 35개 전부 존재 |
| `cues` | string[] | 3~5개, 각 1~200자 |
| `mistakes` | string[] | 2~4개, 각 1~200자 |
| `primaryMuscles` | MuscleId[] | 1~3개 |
| `secondaryMuscles` | MuscleId[] | 0~4개, 주동근과 겹치지 않음 |

## GuideNote — 동기화 레코드, `type: "guideNote"`

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | Uuid | **종목 id와 같다**(1:1). 기본 종목 id면 거부(`builtin_exercise`) |
| `cues` | string[] | 0~10개, 항목마다 공백 제거 후 1~200자(코드 포인트) |
| `mistakes` | string[] | 0~10개, 같은 규칙 |
| `primaryMuscles` | MuscleId[] | 중복 없음, 0~6개 |
| `secondaryMuscles` | MuscleId[] | 중복 없음, 0~6개, 주동근과 겹치지 않음(`overlap`) |
| `deleted`, `version`, `updatedBy` | | 공통. 툼스톤은 공통 필드만 있어도 통과 |

- 네 목록이 모두 비면 클라이언트는 툼스톤으로 저장한다("가이드 없음"으로 돌아간다).
- 종목이 삭제되면 노트는 그대로 두되 화면에서 숨기고, 종목을 되돌리면 다시 보인다.

## 합쳐진 가이드

`resolveGuide(db, exerciseId)` → `{ kind: 'builtin', guide } | { kind: 'note', note } | { kind: 'none' }`

## 클라이언트 저장소 변경 (IndexedDB v2)

- 새 store는 `guideNotes`(keyPath `id`, 인덱스 `byDirty`)다.
- v1 → v2는 store만 추가하고 meta `cursor`를 0으로 되돌린다(전체 다시 받기).

## 내보내기 형식 v2

`{ "format": "fitness-export", "version": 2, …v1 필드…, "guideNotes": [ { "id", "cues", "mistakes", "primaryMuscles", "secondaryMuscles" } ] }`

툼스톤과 내부 필드는 빼고, 기본 가이드도 내보내지 않는다.
