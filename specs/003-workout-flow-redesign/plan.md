# Implementation Plan: 운동 흐름 개편

**Branch**: `003-workout-flow-redesign` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-workout-flow-redesign/spec.md`

## Summary

기능 1 화면을 플리크식으로 개편한다(근육 지도·동작 그림 제외).
- 진행 화면을 **한 종목씩 보는 구조**로 바꾸고, 진행 점, 지난번 대비, 메모, 기록, 세트 추가·삭제, 모든 세트 완료, 다음 운동을 넣는다.
- 화면 아래에 고정된 **휴식 타이머**를 단다.
- 메인 루틴 카드에 부위·마지막 수행일·정렬을 더하고, **루틴 상세** 화면을 새로 만든다.
- 하단 고정 "자유운동·+ 추가"와 **어두운 테마**(기본)를 넣는다.

데이터 변경은 작다.
- 종목 레코드에 `memo`, 설정 레코드에 `restSeconds`가 생긴다. 둘 다 선택 필드라 이전 데이터와 호환된다.
- 서버 스키마와 동기화 API는 바뀌지 않는다(같은 `validateRecord`를 공유).
- 계산 로직(지난번 대비, 1RM, 마지막 수행일, 부위 요약)은 `shared/stats.ts` 순수 함수로 둔다. 기능 3(성장 차트)이 그대로 다시 쓴다.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), 기능 1과 같다.

**Primary Dependencies**: 런타임 의존성 0을 유지한다. 진동은 `navigator.vibrate`(없으면 생략)를 쓰고, 타이머는 `setInterval`과 실제 시각 기준으로 계산한다.

**Storage**:
- IndexedDB 스키마는 바뀌지 않는다(필드만 추가).
- 휴식 타이머 상태와 테마 선택은 `localStorage`에 둔다(기기별 편의 상태, 실패해도 기본값으로 동작).
- 지금 보고 있는 종목 번호는 URL `#/session/:index`에 둔다.

**Testing**:
- `node --test`: stats(지난번 대비, 1RM, 최고 무게, 누적 볼륨, 최근 세션, 마지막 수행일, 부위 요약), 휴식 타이머 상태 기계(가짜 시계), 메모·휴식 시간 검증, 루틴 정렬
- Playwright E2E: 스토리별 테스트, 기존 E2E를 새 진행 화면 구조에 맞게 수정, axe(어두운·밝은 테마), 320px 점검

**Target Platform / Project Type**: 기능 1과 같다.

**Performance Goals**: 종목 이동은 즉시(100ms 이내)여야 한다. 기록·대비 계산은 세션 500개 기준으로 체감 지연이 없어야 하고, 진행 화면을 열 때 한 번 계산한다.

**Constraints**:
- 타이머 표시 오차는 1초 이내여야 한다(SC-003). 그래서 남은 시간을 끝나는 시각에서 매번 다시 계산한다.
- 출력은 `textContent`로만 한다. 색 대비는 WCAG AA를 지킨다.

**Scale/Scope**: 화면 2개(루틴 상세, 진행 화면)를 새로 만들고, 화면 3개(메인, 설정, 앱 셸)를 바꾼다. 공용 로직 모듈 1개를 추가한다.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 내용 | 결과 |
|---|---|---|
| I. 직관적 UX 우선 | 한 종목씩 보여 줘 집중할 수 있다. 완료 탭 1회로 휴식 타이머가 시작되고(SC-001), 다음 운동은 탭 1회다(SC-002). 큰 터치 영역, 하단 고정 버튼, 어두운·밝은 테마 토큰, 로딩·빈·오류 상태를 둔다 | ✅ |
| II. 데이터 무결성과 소유권 | 메모는 입력할 때마다 IndexedDB 트랜잭션으로 저장되고 기존 동기화·내보내기·전체 삭제 경로를 그대로 쓴다. 새 필드는 선택이라 이전 데이터를 그대로 읽는다(마이그레이션 불필요). 휴식 타이머는 기록이 아니라 기기별 임시 상태라 동기화하지 않는다 | ✅ |
| III. 가이드 콘텐츠 | 근육 지도·동작 그림은 범위에서 뺐다 | ✅ (해당 없음) |
| IV. 데이터 기반 성장 시각화 | 지난번 대비·1RM·최고 무게·누적 볼륨은 저장된 기록에서만 계산하고, UI와 분리된 순수 함수(`shared/stats.ts`)로 둬 단위 테스트한다. 1RM은 "추정"으로 표시한다 | ✅ |
| V. 네이티브 확장 + 프라이버시 | 진동은 웹 표준 API를 쓰고, 없으면 조용히 생략한다. 나중에 네이티브 래퍼에서 햅틱으로 바꿀 수 있도록 `client/src/feedback.ts` 한 곳에 모은다 | ✅ |
| 기술/플랫폼 제약 | 새 의존성 없음, WCAG 2.1 AA(두 테마 모두 axe), 320px | ✅ |
| 개발 워크플로 | 계산·타이머·검증은 테스트를 먼저 쓴다. 핵심 흐름(시작 → 세트 완료 → 휴식 → 다음 운동 → 완료)은 E2E로 검증한다. `lint`·`test`·`test:e2e` 통과가 병합 조건이다 | ✅ |

**Post-design 재확인**: 서버 코드는 바뀌지 않는다(공유 검증만 확장). 내보내기 형식에는 `memo`·`restSeconds`가 필드로 자연스럽게 포함된다(형식 버전은 그대로 1, 필드 추가는 상위 호환). **GATE 통과**.

## Project Structure

### Documentation (this feature)

```text
specs/003-workout-flow-redesign/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/record-fields.md   # 종목·설정 레코드의 새 필드(동기화 계약 변경분)
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
shared/
├── stats.ts                 # 새로 추가: 지난번 대비, 추정 1RM, 최고 무게, 누적 볼륨, 최근 세션, 마지막 수행일, 부위 요약
├── model.ts                 # 수정: Exercise.memo(선택, 0~500자), Settings.restSeconds(선택, 15~600, 15 단위)
└── tests/stats.test.ts, model.test.ts(추가)

client/src/
├── rest-timer.ts            # 휴식 타이머 상태 기계(끝나는 시각 기준, localStorage 저장, 가짜 시계 주입)
├── feedback.ts              # 진동 (나중에 네이티브 햅틱으로 바꿀 자리)
├── theme.ts                 # 테마 선택(어둡게/밝게/시스템) → <html data-theme>
├── exercises.ts             # 수정: setExerciseMemo
├── settings.ts              # 수정: get/setRestSeconds
├── sessions.ts              # 수정: completeAllSets, removeLastSet
├── routines.ts              # 수정: 정렬, 루틴 카드 요약(부위·마지막 수행일)
├── app.ts                   # 수정: Screen.back(뒤로 링크), Screen.focus(하단 탭 숨김)
├── styles.css               # 수정: 어두운 테마 토큰(기본), 하단 고정 바, 진행 점, 타이머, 카드
└── ui/
    ├── routine-list.ts      # 수정: 카드(부위·마지막 수행일·시작 아이콘·⋯), 정렬, 하단 고정 버튼
    ├── routine-detail.ts    # 새로 추가: 루틴 상세(종목 목록, 하단 시작·운동 추가, ⋯)
    ├── session-screen.ts    # 다시 작성: 한 종목씩, 진행 점, 대비, 메모, 기록, 세트 조작, 다음 운동
    ├── rest-timer-bar.ts    # 새로 추가: 하단 고정 휴식 타이머
    └── settings.ts          # 수정: 테마 선택

e2e/                         # 기존 스펙 수정, flow-*.spec.ts 추가, a11y 확장
```

**Structure Decision**: 기능 1의 구조를 그대로 둔다.
- 계산은 `shared/`, 기기별 상태(타이머·테마)는 `client/src/`의 작은 모듈로 나눈다.
- 진행 화면은 구조가 바뀌어 다시 작성하되, 도메인 함수(`sessions.ts`)는 재사용한다.

## Complexity Tracking

위반 사항이 없어 작성하지 않는다.
