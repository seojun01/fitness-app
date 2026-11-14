# Data Model: 운동 가이드

**Feature**: `002-exercise-guide` | **Date**: 2026-11-14 | **근거**: [spec.md](./spec.md) Key Entities, [research.md](./research.md) G1~G7

공통 타입(`Uuid`, `Hlc`, 공통 동기화 필드)은 [기능 1 data-model](../001-routine-workout-logging/data-model.md)을 따른다.

---

## Muscle (근육, 고정 목록)

`MuscleId` = `"pectorals" | "lats" | "traps" | "rhomboids" | "frontDelts" | "sideDelts" | "rearDelts" | "biceps" | "triceps" | "forearms" | "abs" | "obliques" | "erectors" | "glutes" | "quads" | "hamstrings" | "calves"`

각 근육은 한국어 이름(대흉근, 광배근, …)과 강조할 뼈 구간·면(앞/뒤)을 가진다(`shared/body/muscles.ts`).

## GuideNote (사용자 가이드 노트) — 동기화 레코드, `type: "guideNote"`

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | Uuid | **종목 id와 같다**(1:1). 기본 종목 id이면 거부(FR-012) |
| `cues` | string[] | 자세 요점. 0~10개, 항목마다 공백 제거 후 1~200자(코드 포인트) |
| `mistakes` | string[] | 흔한 실수. 0~10개, 항목 규칙 동일 |
| `primaryMuscles` | MuscleId[] | 중복 없음, 0~6개 |
| `secondaryMuscles` | MuscleId[] | 중복 없음, 0~6개, `primaryMuscles`와 겹치지 않음 |
| `deleted`, `version`, `updatedBy` | | 공통. 툼스톤은 공통 필드만 있어도 통과 |

- 네 목록이 모두 비면 클라이언트는 저장하지 않고 툼스톤으로 만든다("가이드 없음"으로 돌아감).
- 종목이 삭제(툼스톤)되면 노트는 그대로 두되 목록·화면에서 숨긴다. 종목을 되돌리면 노트도 다시 보인다.

### 상태 전이

```text
(없음) ── 저장(내용 있음) ──▶ 활성 ── 수정 ──▶ 활성 (각 전이마다 version 새로 발급)
                              │
                 모두 비움·전체 삭제
                              ▼
                       툼스톤(deleted=true) ── 다시 저장 ──▶ 활성
```

## BuiltinGuide (기본 가이드) — 앱 내장, 읽기 전용, 동기화하지 않음

| 필드 | 타입 | 규칙 |
|---|---|---|
| `exerciseId` | Uuid | 기본 종목 id. 35개 전부 존재(SC-003) |
| `cues` | string[] | 3~5개, 1~200자 |
| `mistakes` | string[] | 2~4개, 1~200자 |
| `primaryMuscles` | MuscleId[] | 1~3개 |
| `secondaryMuscles` | MuscleId[] | 0~4개, 주동근과 겹치지 않음 |
| `motion` | Motion \| null | 기본 종목은 모두 있음 |
| `alt` | string | 동작을 한두 문장으로 설명하는 대체 텍스트 |

형식은 [contracts/guide-content.md](./contracts/guide-content.md)에 있다.

## Motion · Pose · Skeleton (앱 내부)

- **Skeleton**: 관절 17개의 계층(부모·뼈 길이·기본 방향·가동 범위). 키 1.0으로 정규화한다.
- **Pose**: `{ root: { x, y, z, yaw, pitch, roll }, joints: Record<JointId, { flex, abd, twist }> }`. 생략한 관절은 기본 자세(0)다.
- **Motion**: `{ keyframes: { t: 0..1, pose }[], durationMs, view: 'side'|'front'|'back'|'top45', props: Prop[], poster: number }`
  - `t`는 오름차순이고 첫 값 0, 마지막 값 1이다. 마지막 포즈 = 첫 포즈(루프).
  - `poster`는 대표 자세를 고를 `t`다(정지 화면, 목록 미리보기, 동작 줄이기).
- **Prop**: `{ kind: 'barbell'|'dumbbells'|'bench'|'inclineBench'|'pullupBar'|'cable'|'floor'|'box'|'rope'|'bike'|'rower', attach?: 'hands'|'feet', at?: [x,y,z] }`

## 합쳐진 가이드 (화면에서 쓰는 값)

`resolveGuide(exercise)` → `{ kind: 'builtin', guide } | { kind: 'note', note, bodyPart } | { kind: 'none', bodyPart }`
- 기본 종목은 `builtin`이다(사용자가 이름을 바꿔도 id로 찾는다).
- 직접 만든 종목은 살아 있는 노트가 있으면 `note`, 없으면 `none`이다.
- `note`·`none`의 그림 자리에는 부위(bodyPart)를 강조한 기본 서 있는 자세를 그린다.

## 클라이언트 저장소 변경 (IndexedDB v2)

- 새 store는 `guideNotes`(keyPath `id`, 인덱스 `byDirty`)다.
- v1 → v2 업그레이드는 store만 추가하고 기존 데이터는 그대로 둔다.

## 내보내기 형식 v2 (FR-016)

```json
{ "format": "fitness-export", "version": 2, "exportedAt": "…",
  "exercises": [], "routines": [], "sessions": [], "settings": {},
  "guideNotes": [ { "id": "…", "cues": [], "mistakes": [], "primaryMuscles": [], "secondaryMuscles": [] } ] }
```

- 툼스톤과 내부 필드는 제외한다. 기본 가이드는 앱의 일부라 내보내지 않는다.
- 전체 삭제는 모든 노트를 툼스톤으로 만든다.
