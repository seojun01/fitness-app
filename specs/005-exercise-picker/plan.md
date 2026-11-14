# Implementation Plan: 종목 선택 개편과 기본 종목 확장

**Branch**: `005-exercise-picker` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

## Summary

종목 선택을 플리크식 전체 화면으로 다시 만든다(검색, 세 줄 필터, 좋아요, 더보기, 여러 개 선택 후 한 번에 추가). 기본 종목은 35개에서 91개로 늘리고, 모두에 장비·텍스트 가이드를 붙인다. 이미 쓰던 기기는 기본 종목 세트 버전이 오르면 새 종목을 받는다. 결정은 [research.md](./research.md), 데이터는 [data-model.md](./data-model.md)에 있다.

## Technical Context

기능 1~3과 같다(TypeScript, 런타임 의존성 0, IndexedDB + 홈서버 동기화, `node --test` + Playwright).
- **데이터 변경**: 종목 레코드에 선택 필드 `equipment`·`favorite`를 추가한다. 서버 스키마는 그대로이고 공유 검증만 늘어난다.
- **성능**: 종목 91개 필터링은 메모리에서 즉시 한다. 사용 통계(자주·최근)는 선택 화면을 열 때 한 번 계산한다.

## Constitution Check

| 원칙 | 확인 | 결과 |
|---|---|---|
| I. UX | 여러 개 선택으로 선택 화면을 한 번만 연다(SC-001). 큰 터치 영역, 하단 고정 버튼, 320px에서 필터 줄만 가로 스크롤 | ✅ |
| II. 데이터 | 좋아요·장비는 기존 레코드 경로로 저장·동기화된다. 기본 종목 세트 업그레이드는 사용자가 고친 종목을 건드리지 않는다(FR-011, 테스트로 검증) | ✅ |
| III. 가이드 | 새 기본 종목 56개 모두 텍스트 가이드를 갖는다(콘텐츠 무결성 테스트가 전수 검사) | ✅ |
| IV·V | 해당 없음 / 네이티브 API 없음 | ✅ |
| 기술·워크플로 | 새 의존성 없음, 검증·필터·업그레이드는 테스트를 먼저 쓴다, axe 두 테마·320px | ✅ |

**GATE 통과** (설계 후 재확인 동일).

## Project Structure

```text
shared/
├── model.ts            # Exercise.equipment?, Exercise.favorite? 검증, EQUIPMENT 목록
├── seed-exercises.ts   # 91개, 장비 포함, SEED_SET 버전
├── guides.ts           # 새 56개 가이드
└── muscle-groups.ts    # 근육 부위 필터 12그룹 ↔ 근육 17종, 종목 태그 계산
client/src/
├── store/records.ts    # ensureSeed: 세트 버전 업그레이드
├── exercises.ts        # toggleFavorite, createExercise(장비), equipmentOf
├── exercise-catalog.ts # 필터·검색·사용 통계(자주·최근)·태그 (순수 함수 + 로딩)
├── ui/exercise-picker.ts  # 다시 작성: 전체 화면, 여러 개 선택 → string[]
├── ui/routine-editor.ts, ui/routine-detail.ts, ui/session-screen.ts  # 여러 개 추가
└── routines.ts         # appendExercises(여러 개, 한도)
```

## Complexity Tracking

위반 없음.
