# Data Model: 운동 루틴 관리 및 세트 기록

**Feature**: `001-routine-workout-logging` | **Date**: 2026-11-14 | **근거**: [spec.md](./spec.md) Key Entities, [research.md](./research.md) R6·R9~R16

## 공통 타입

| 타입 | 형식 | 예 |
|---|---|---|
| `Uuid` | UUID v4 문자열 (클라이언트가 `crypto.randomUUID()`로 생성. 기본 종목은 고정 id) | `"3f2c…"` |
| `DeviceId` | `Uuid`. 클라이언트가 첫 실행 때 생성하고 페어링 때 서버에 등록 | |
| `Instant` | UTC ISO-8601, 밀리초 포함 | `"2026-11-14T12:34:56.789Z"` |
| `Hlc` | `<wallMs 15자리 0채움>-<counter 6자리 0채움>-<deviceId>` (문자열 비교 순서 = 시간 순서) | |
| `BodyPart` | `"chest" \| "back" \| "shoulders" \| "legs" \| "arms" \| "core" \| "cardio" \| "other"` | |

모든 동기화 레코드는 공통 필드 `id`, `deleted`(툼스톤), `version`(Hlc), `updatedBy`(DeviceId)를 가진다. `deleted=true`인 레코드는 모든 화면·집계·내보내기에서 제외한다.

---

## Exercise (운동 종목)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | Uuid | 기본 종목은 고정 id |
| `name` | string | 공백 제거 후 1~60자 (코드 포인트) |
| `bodyPart` | BodyPart | 기본 `"other"` |
| `custom` | boolean | 사용자가 만든 종목이면 `true` |
| `bodyweight` | boolean | 맨몸 운동이면 `true` (무게 입력 기본값 0, 선택) |
| `deleted`, `version`, `updatedBy` | | 공통 |

- 삭제해도 이미 기록된 세션·루틴에는 영향이 없다(세션은 `exerciseName`을 복사해 둔다. 아래 참조).

## Routine (루틴)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | Uuid | |
| `name` | string | 1~60자 |
| `items` | RoutineItem[] | 순서가 곧 배열 순서. 0~50개 |
| `createdAt` | Instant | 불변 |
| `deleted`, `version`, `updatedBy` | | 공통 |

**RoutineItem**: `{ exerciseId: Uuid, targetSets: 1..20 }`. 같은 종목이 여러 번 들어갈 수 있다.

- 삭제된 종목을 가리키는 항목은 읽을 때 "삭제된 종목"으로 표시하고 세션 시작 시 건너뛴다(고아 항목은 데이터 유실 없이 계산).
- 루틴 삭제(툼스톤)는 과거 세션에 영향이 없다(FR-013): 세션이 `routineName`을 복사해 둔다.
- 복제(FR-001)는 새 `id`, 이름 `"<원본> 복사"`(60자 초과 시 자름), `items` 깊은 복사.

## Session (운동 세션)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | Uuid | |
| `status` | `"active" \| "completed"` | 진행 중 세션은 **기기당** 최대 1개(`startedBy` 기준, 클라이언트가 보장). 서로 다른 기기의 진행 중 세션은 동시에 존재할 수 있다 |
| `routineId` | Uuid \| null | 빈 세션이면 `null` |
| `routineName` | string \| null | 시작 시점의 이름 복사 (FR-013) |
| `startedAt` | Instant | 불변 |
| `endedAt` | Instant \| null | `status=completed`일 때 필수 |
| `startedBy` | DeviceId | 진행 중 세션을 편집할 수 있는 기기 |
| `entries` | SessionEntry[] | 순서 있음. 0~50개 |
| `deleted`, `version`, `updatedBy` | | 공통 |

**SessionEntry**: `{ entryId: Uuid, exerciseId: Uuid, exerciseName: string, sets: SetEntry[] }` — `exerciseName`은 추가 시점의 이름 복사(종목이 나중에 삭제·개명되어도 기록이 읽힌다). 같은 `exerciseId`가 여러 항목에 있을 수 있다. `sets`는 0~50개.

**SetEntry**: `{ setId: Uuid, weightKg: number \| null, reps: integer \| null, done: boolean }`

- `weightKg`: 0 이상 1000 이하, 소수 넷째 자리로 반올림해 저장 ([R11](./research.md)). `done=false`인 세트에서만 `null`(아직 비어 있음)일 수 있다.
- `reps`: 1 이상 999 이하 정수. 마찬가지로 `done=false`일 때만 `null` 가능.
- `done=false`는 아직 확정하지 않은 세트(미리 채운 값 포함). 요약·볼륨·직전 값 계산은 `done=true`만 쓴다.

### 파생 값 (저장하지 않고 `shared/volume.ts`가 계산)

| 이름 | 정의 |
|---|---|
| `setVolume` | `weightKg × reps` (done인 세트만) |
| `entryVolume` | 항목 내 done 세트의 `setVolume` 합 |
| `sessionVolume` | 모든 항목의 `entryVolume` 합 (FR-008 총 볼륨) |
| `completedSets` | done 세트 개수 |
| `durationSec` | `endedAt − startedAt` (완료 세션). 진행 중에는 현재 시각 기준 |

### 상태 전이

```text
          start(루틴/빈)                 finish                    edit(완료 후 수정)
(없음) ───────────────▶ active ────────────────▶ completed ◀──────────────┐ 각 전이마다 version 새로 발급
                         │  ▲                       │                       │
                         │  └── 앱 재실행: 복원 ─────┘                       │
              discard    │              delete                              │
         (set 0개 종료 포함)▼                ▼                              │
                     툼스톤(deleted=true) ◀────┴──────────────────────────────┘
```

- `finish`: `endedAt`을 지금으로 정하고 `status=completed`. 완료 세트가 0개이면 저장 여부를 확인하고, 저장하지 않으면 툼스톤으로 폐기한다.
- 완료된 세션의 세트 수정·삭제와 세션 삭제는 `version`을 새로 발급한다. 삭제는 5초 이상 표시되는 되돌리기를 제공한다(같은 기기).
- `active` 세션은 `startedBy`가 아닌 기기에서는 읽기 전용이다.

## Settings (사용자 설정)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `id` | 고정 `"settings"` | 레코드 하나 |
| `weightUnit` | `"kg" \| "lb"` | 기본 `"kg"` |
| `deleted`, `version`, `updatedBy` | | 공통. 항목 단위 LWW |

## 내보내기 형식 (FR-014)

```json
{
  "format": "fitness-export",
  "version": 1,
  "exportedAt": "2026-11-14T12:34:56.789Z",
  "exercises": [ … ], "routines": [ … ], "sessions": [ … ], "settings": { … }
}
```

- 툼스톤(`deleted=true`)은 제외한다. 내부 필드(`version`, `updatedBy`)는 포함하지 않는다. 무게는 `weightKg`로 내보낸다.

## 서버 SQLite 스키마 (요약)

- `records(type TEXT, id TEXT, version TEXT, deleted INTEGER, body TEXT, seq INTEGER UNIQUE, PRIMARY KEY(type,id))` — 변경될 때마다 새 `seq`.
- `devices(id, name, token_hash, created_at, last_seen_at, revoked_at)`.
- `pair_codes(code_hash, name, expires_at, used_at)`.
- 마이그레이션은 `PRAGMA user_version`으로 관리한다. 클라이언트 IndexedDB도 버전 번호로 업그레이드 경로를 둔다.
