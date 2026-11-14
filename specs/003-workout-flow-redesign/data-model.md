# Data Model: 운동 흐름 개편

**Feature**: `003-workout-flow-redesign` | **근거**: [spec.md](./spec.md), [research.md](./research.md) W2~W7

기능 1 [data-model](../001-routine-workout-logging/data-model.md)에 필드 두 개를 더하고, 계산값을 정의한다. 새 레코드 종류는 없다.

## 레코드 필드 추가 (동기화됨)

| 레코드 | 필드 | 타입 | 규칙 |
|---|---|---|---|
| Exercise | `memo` | string (선택) | 0~500자(코드 포인트). 없으면 빈 메모로 읽는다 |
| Settings | `restSeconds` | integer (선택) | 15~600, 15의 배수. 없으면 60 |

검증은 `shared/model.ts`의 `validateRecord`에 추가한다. 서버와 클라이언트가 같은 규칙을 쓴다([contracts/record-fields.md](./contracts/record-fields.md)).

## 기기 로컬 상태 (동기화 안 함, `localStorage`)

| 키 | 값 | 비고 |
|---|---|---|
| `fitness.restTimer` | `{ state: 'idle' } \| { state: 'running', endsAt: number, totalMs: number } \| { state: 'paused', remainingMs: number, totalMs: number } \| { state: 'done' }` | 읽을 수 없거나 깨져 있으면 `idle` |
| `fitness.theme` | `'dark' \| 'light' \| 'system'` | 기본 `dark` |
| `fitness.routineSort` | `'recent' \| 'name'` | 기본 `recent` |
| `fitness.sessionIndex` | `{ sessionId, index }` | `#/session`으로 열 때 마지막 종목 위치 |

### 휴식 타이머 상태 전이

```text
idle ──start(base)──▶ running ──now ≥ endsAt──▶ done ──start/stop──▶ running / idle
                        │  ▲
                 pause  │  │ resume
                        ▼  │
                       paused ──stop──▶ idle
running/paused ──±15s──▶ (남은 시간 조절, 0 이하가 되면 done)
idle ──±15s──▶ idle(base 변경, Settings.restSeconds 저장)
```

## 계산값 (`shared/stats.ts`, 저장하지 않음)

| 함수 | 결과 |
|---|---|
| `previousTotals(exerciseId, sessions, excludeSessionId)` | `{ sessionId, endedAt, volumeKg, reps, allZero } \| null`. 가장 최근 완료 세션(제외 세션 빼고)의 그 종목 완료 세트 합계 |
| `entryTotals(entry)` | `{ volumeKg, reps, allZero }`. 지금 항목의 완료 세트 합계. `allZero`는 "완료 세트가 있고 무게가 모두 0" |
| `compare(current, previous, bodyweight)` | `{ metric: 'volume'\|'reps', current, previous, diff, direction: 'up'\|'down'\|'same'\|'first' }` |
| `exerciseRecords(exerciseId, sessions)` | `{ best1rmKg, maxWeightKg, totalVolumeKg, maxReps, totalReps, recent: { endedAt, sets }[] (최대 2) }` |
| `estimate1rm(w, r)` | `r === 1 ? w : w × (1 + r/30)`, w = 0이면 0 |
| `lastPerformed(routineId, sessions)` | 최신 `endedAt` 또는 `null` |
| `relativeDay(iso, now)` | `'오늘' \| '어제' \| 'N일 전' \| 'YYYY.M.D'` (30일을 넘으면 날짜) |
| `routineBodyParts(routine, exercises)` | 루틴 순서대로 중복 없는 부위 목록 |

- 모든 계산은 삭제된 세션, 진행 중 세션, 완료하지 않은 세트를 제외한다.
- 무게는 kg로 계산하고, 표시할 때 `formatWeight`로 단위를 바꾼다.
