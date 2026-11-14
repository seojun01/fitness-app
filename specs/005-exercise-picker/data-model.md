# Data Model: 종목 선택 개편과 기본 종목 확장

## Exercise 필드 추가 (동기화, 선택 필드)

| 필드 | 타입 | 규칙 |
|---|---|---|
| `equipment` | `'bodyweight' \| 'dumbbell' \| 'barbell' \| 'smith' \| 'machine' \| 'cable' \| 'band' \| 'kettlebell' \| 'cardio' \| 'other'` | 선택. 없으면 research P3의 기본값 |
| `favorite` | boolean | 선택. 없으면 false |

검증은 `shared/model.ts`에서 한다(목록 밖 값은 `enum`, 불리언이 아니면 `type`). 이전 레코드(필드 없음)는 그대로 유효하다.

## 기기 메타

| 키 | 값 |
|---|---|
| `seedSet` | 이 기기가 받은 기본 종목 세트 번호(없으면 1로 본다) |

## 계산값 (저장하지 않음)

- `exerciseTags(exercise, guide?, note?) → MuscleGroup[]`: 주동근 → 보조근 순서, 중복 없음
- `usageStats(sessions) → Map<exerciseId, { count, lastUsed }>`
- `filterCatalog(items, { query, category, group, equipment }) → items` (분류 `frequent`·`recent`는 정렬 순서도 정한다)
