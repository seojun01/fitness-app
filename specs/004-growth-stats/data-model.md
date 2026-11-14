# Data Model: 성장 차트·통계

**Feature**: `004-growth-stats` | **Plan**: [plan.md](./plan.md)

**저장 스키마 변경 없음.** 모든 값은 기존 레코드(세션·종목)에서 계산한다(헌법 IV). 기기별 화면 상태 하나만 localStorage에 둔다.

## 기기 상태

| 키 | 값 | 기본 |
|---|---|---|
| `localStorage['fitness.statsPeriod']` | `'4w' \| '3m' \| '1y' \| 'all'` | `'4w'` (깨진 값이면 기본) |

## 계산값 (`shared/growth.ts`, 모두 순수 함수)

입력의 "완료 세션"은 `status==='completed' && !deleted && endedAt`인 세션이다. "완료 세트"는 `done && weightKg!==null && reps!==null`인 세트다. 날짜 키 `DayKey`는 `startedAt`의 기기 현지 날짜 `YYYY-MM-DD`이다.

### Period / Range
```ts
type Period = '4w' | '3m' | '1y' | 'all';
interface Range { start: DayKey; end: DayKey; days: number }        // 양 끝 포함
periodRange(period, now, firstDay?: DayKey): Range | null           // 'all' 인데 기록 없음 → null
previousRange(range): Range                                          // 바로 앞, 같은 일수
```

### PeriodSummary (US2)
```ts
interface PeriodSummary { sessions: number; volumeKg: number; durationSec: number }
summarizeRange(sessions, range): PeriodSummary
// 증감: current - previous (Period !== 'all' 일 때만)
```
- `durationSec`은 `endedAt - startedAt`이고, 0 미만이면 0이다(기존 `durationSec`과 같다).

### Buckets (US2)
```ts
interface Bucket { start: DayKey; label: string; sessions: number; volumeKg: number }
buckets(sessions, range): { unit: 'week' | 'month'; items: Bucket[] }
```
- 주 시작은 월요일이다. 기간과 겹치는 모든 주·달을 0 포함해 시간순으로 둔다.
- `range.days > 371`이면 `month`이다.
- `label`은 주면 `M/D`(월요일), 달이면 `YY.M`이다.

### BodyPartShare (US3)
```ts
interface PartShare { part: BodyPart; sets: number; ratio: number; volumeKg: number; exerciseIds: string[] }
bodyPartShare(sessions, exercises: Map<id, {bodyPart}>, range): PartShare[]
```
- 8개 부위가 모두 나온다. 세트 수 내림차순이고, 같으면 `BODY_PARTS` 순서다. 0세트 부위는 맨 아래에 둔다.
- `ratio`는 `sets / 전체 세트`이고, 전체가 0이면 0이다. 표시할 때 %는 정수로 반올림한다.
- 종목 맵에 없는 종목(삭제 후 정리 등)은 `other`로 센다.
- `exerciseIds`는 그 부위 종목을 세트 수 내림차순으로 둔다.

### ExercisePoint / Series (US1)
```ts
interface ExercisePoint {
  sessionId: string; day: DayKey;
  e1rmKg: number; maxWeightKg: number; volumeKg: number; totalReps: number; maxReps: number;
  sets: { weightKg: number; reps: number }[];   // 그 세션의 완료 세트 (묶은 점이면 빈 배열)
}
exerciseSeries(exerciseId, sessions, range, maxPoints = 60): { points: ExercisePoint[]; grouped: boolean; bodyweightLike: boolean }
```
- 같은 세션에 같은 종목이 두 번 있으면 합친다. 완료 세트가 없는 세션은 점을 만들지 않는다.
- `e1rmKg`는 `estimate1rm`(stats.ts) 세트 최대를 소수 1자리로 반올림한 값이다. 나머지 무게는 4자리 반올림이다.
- 점이 `maxPoints`를 넘으면 주별로 묶는다. 각 지표는 그 주의 최대이고, `sessionId`는 그 주 첫 세션이다.
- `bodyweightLike`는 기간 안 모든 완료 세트의 무게가 0일 때 참이다.

### PersonalRecords (US1)
```ts
interface PR { value: number; day: DayKey; sessionId: string }   // value: 무게(kg) 또는 횟수
personalRecords(exerciseId, sessions): { e1rm: PR|null; maxWeight: PR|null; sessionVolume: PR|null; maxReps: PR|null; sessionReps: PR|null }
```
- 전체 기간이 대상이다. 값이 같으면 먼저 달성한 날을 남긴다. 기록이 없으면 모두 null이다.

### CalendarMonth (US4)
```ts
interface CalendarDay { day: DayKey; inMonth: boolean; sessionIds: string[] }
calendarMonth(sessions, year, month /*1-12*/): { weeks: CalendarDay[][]; activeDays: number }
```
- 월요일에 시작하는 6×7 또는 5×7 격자다. 앞뒤 달 날짜는 `inMonth=false`이고 세션을 세지 않는다.
- `sessionIds`는 시작 시각 오름차순이다.

### ExercisesWithHistory (FR-006)
```ts
exercisesByRecency(sessions): { exerciseId: string; lastDay: DayKey; sessions: number }[]   // 최근 순
```
