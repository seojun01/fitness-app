# Implementation Plan: 성장 차트·통계

**Branch**: `004-growth-stats` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

## Summary

하단에 "통계" 탭을 더한다. 탭에서는 다음을 보여 준다.
- 기간 요약과 증감
- 주별(전체 기간이 길면 월별) 막대
- 부위별 비중
- 운동 달력
- 종목 찾기

종목 차트 화면에서는 추정 1RM·최고 무게·세션 볼륨(맨몸이면 횟수) 추이를 선 차트로, 개인 최고 기록 네 가지를 함께 보여 준다. 세션 상세·종목 이력·진행 화면 "기록"에서 종목 차트로 바로 간다(진행 화면은 대화상자).

계산은 모두 `shared/growth.ts`의 순수 함수가 맡는다. 엡리·완료 세트 규칙은 `shared/stats.ts`를 재사용한다. 차트는 의존성 없이 인라인 SVG로 그리고, 같은 내용을 표·글로도 준다. 저장 스키마와 서버는 바뀌지 않는다. 결정은 [research.md](./research.md), 계산값은 [data-model.md](./data-model.md), 화면 계약은 [contracts/ui.md](./contracts/ui.md)에 있다.

## Technical Context

**Language/Version**: TypeScript 5.x strict (erasableSyntaxOnly), Node ≥22.18 (테스트), 브라우저 ES2022

**Primary Dependencies**: 없음(런타임 의존성 0 유지). 차트는 직접 만든 SVG(research S8)

**Storage**: 변경 없음. 기존 IndexedDB 세션·종목 레코드를 읽기만 한다. 기간 선택은 localStorage `fitness.statsPeriod`

**Testing**: `node --test` (`shared/tests/growth.test.ts`: 모든 집계 함수, 경계—자정·월요일·기간 끝·삭제/진행 중 세션·미완료 세트·같은 세션 중복 종목·묶기·PR 동률), Playwright(chromium·webkit·mobile·narrow-320, axe 두 테마)

**Target Platform**: iOS Safari 홈 화면 PWA(주), 데스크톱 브라우저

**Project Type**: 웹 앱(클라이언트 + 홈서버). 이번 기능은 클라이언트만

**Performance Goals**: 세션 500개에서 통계 탭·종목 차트 첫 표시 1초 이내(SC-001). 기간 바꾸기는 다시 읽지 않고 메모리에서 계산

**Constraints**: 오프라인 동작(FR-012), 320px 폭, 색에만 의존하지 않음, innerHTML 금지, 기기 현지 날짜(FR-014)

**Scale/Scope**: 새 화면 3개, 공유 모듈 1개, 차트 함수 3종, 기존 화면 3곳에 진입점 추가

## Constitution Check

| 원칙 | 확인 | 결과 |
|---|---|---|
| I. UX | 탭 하나로 대시보드, 진행 화면에서 탭 2회로 종목 차트(SC-003). 대화상자라 진행 상태 유지. 320px·큰 터치 영역·두 테마 | ✅ |
| II. 데이터 | 읽기 전용. 새 저장 데이터 없음(기간 선택만 기기 로컬) | ✅ |
| III. 가이드 | 해당 없음 | ✅ |
| IV. 성장 시각화 | 계산은 `shared/growth.ts` 순수 함수 + 단위 테스트(MUST). 저장된 기록에서만 계산. 볼륨·최대 중량·추정 1RM 추이. 차트는 라벨·요약 문장·표 제공, 색에만 의존 안 함 | ✅ |
| V. 확장·프라이버시 | 외부 전송 없음, 네이티브 API 없음. 계산이 공유 모듈이라 나중에 네이티브 래퍼에서도 재사용 | ✅ |
| 기술·워크플로 | 새 의존성 없음, 계산 테스트를 먼저 쓴다, axe 두 테마·320px, 500세션 성능 확인 | ✅ |

**GATE 통과**. 설계 후 다시 확인한 결과도 같다. 차트 라이브러리를 쓰지 않기로 해 의존성 제약을 지키고, 접근성 요구(FR-013)는 contracts/ui.md에 이름 단위로 고정했다.

## Project Structure

### Documentation (this feature)

```text
specs/004-growth-stats/
├── spec.md
├── plan.md              # 이 문서
├── research.md          # S1~S12 결정
├── data-model.md        # 계산값 정의 (저장 스키마 변경 없음)
├── contracts/ui.md      # 경로·접근 가능한 이름
├── quickstart.md
└── tasks.md             # /speckit-tasks
```

### Source Code

```text
shared/
├── growth.ts             # 신규: periodRange, previousRange, summarizeRange, buckets, bodyPartShare,
│                         #       exerciseSeries, personalRecords, calendarMonth, exercisesByRecency, dayKey
├── stats.ts              # completedSessions export (내부 completed 재사용)
└── tests/growth.test.ts  # 신규

client/src/
├── stats-period.ts       # 기간 선택 기억 (localStorage, 깨진 값 → '4w')
├── app.ts                # Screen.tab 에 'stats', 탭 5개
├── routes.ts             # /stats, /stats/exercise/:id, /stats/day/:day
├── ui/charts.ts          # 신규: lineChart(점 고르기 포함), columnChart, 접근 가능한 표
├── ui/stats-screen.ts    # 신규: 대시보드 (요약, 막대, 부위, 달력, 종목 찾기)
├── ui/exercise-chart-view.ts  # 신규: 종목 차트 본문 (화면·대화상자 공용)
├── ui/exercise-chart.ts  # 신규: #/stats/exercise/:id 화면 + openExerciseChartDialog
├── ui/stats-day.ts       # 신규: 그날 세션 목록
├── ui/session-detail.ts  # "차트" 링크
├── ui/exercise-history.ts # "차트 보기" 링크
├── ui/session-screen.ts  # "기록" 안 "차트 보기" → 대화상자
└── styles.css            # 차트·달력·부위 막대 스타일 (토큰 사용)

e2e/
├── stats.spec.ts         # US1~US5
└── a11y.spec.ts          # 통계·종목 차트 추가
```

**Structure Decision**: 기존 구조(공유 순수 계산 + 클라이언트 화면)를 그대로 따른다. 서버·동기화·스키마는 바꾸지 않는다.

## Complexity Tracking

위반 없음.
