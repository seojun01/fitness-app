# Contract: 기본 가이드·동작 정의 형식 (앱 내부)

기본 가이드는 앱과 함께 배포되는 데이터다(`shared/guides/`). 외부에 공개되는 API는 아니지만 렌더러·콘텐츠 작성·테스트가 공유하는 계약이라 고정해 둔다. 타입 이름은 [data-model.md](../data-model.md)를 따른다.

## 조회 함수

| 함수 | 결과 |
|---|---|
| `listBuiltinGuides()` | 기본 종목 35개의 `BuiltinGuide[]` (기본 종목 순서) |
| `getBuiltinGuide(exerciseId)` | `BuiltinGuide \| undefined` |
| `poseAt(motion, t)` | 0 ≤ t < 1에서의 `Pose` (키프레임 보간, 이징 적용, t는 주기에 대해 반복) |
| `solve(pose)` | `Record<JointId, [x, y, z]>` 관절 월드 좌표 (FK) |
| `project(points, camera)` | 직교 투영 화면 좌표와 깊이. `camera = { yaw, pitch, distance }` (시점 프리셋 `front`·`side`·`back`·`top45`) |

## 좌표계

- 오른손 좌표계다. y는 위, x는 몸의 오른쪽, z는 몸의 정면이다. 단위는 키(1.0)에 대한 비율이다.
- 바닥은 y = 0이다. 서 있는 기본 자세에서 발목 높이는 약 0.04다.
- 시점 `front`는 정면에서 −z 방향으로 보는 것이고, `side`는 몸의 오른쪽에서, `back`은 뒤에서 보는 것이다.

## 관절 각도 규칙

- `flex`(굽힘 +), `abd`(벌림 +), `twist`(바깥 회전 +)이고, 도 단위다.
- 관절별 가동 범위(예: 무릎 flex 0~150, 팔꿈치 flex 0~150, 어깨 flex −60~180)는 `shared/body/skeleton.ts`에 둔다. 키프레임은 이 범위 안이어야 한다.

## 템플릿

```ts
type Template = (p: TemplateParams) => Motion
// 예: horizontalPress({ incline: 0 | 30, implement: 'barbell' | 'dumbbells' | 'bodyweight', grip: 'wide' | 'normal' })
```

## 콘텐츠 무결성 규칙 (shared/tests/guide-content.test.ts 가 검사)

1. `SEED_EXERCISES`의 모든 id에 기본 가이드가 정확히 하나 있다.
2. 요점 3~5개, 실수 2~4개, 각 1~200자, 주동근 1~3개, 보조근 0~4개, 근육 id는 목록 안의 값, 주동근·보조근 겹침 없음.
3. 모든 동작은 키프레임 ≥ 2, `t`가 0에서 시작해 1로 끝나며 엄격히 증가, 첫 포즈와 마지막 포즈가 같다.
4. 모든 키프레임과 그 사이 보간값(100단계 샘플)이 관절 가동 범위 안이다.
5. `standing` 표시가 붙은 동작은 어느 시점에도 발목 y가 0 미만이 아니다.
6. 모든 뼈 길이가 모든 샘플에서 기본값과 같다(오차 1e-9).
7. `alt` 대체 텍스트는 비어 있지 않다.
