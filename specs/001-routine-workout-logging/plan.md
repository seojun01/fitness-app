# Implementation Plan: 운동 루틴 관리 및 세트 기록

**Branch**: `001-routine-workout-logging` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-routine-workout-logging/spec.md`

## Summary

소유자 한 명이 폰·PC에서 쓰는 개인용 운동 기록 PWA를 만든다. 루틴을 구성하고, 세션 중 세트(무게·횟수)를 빠르게 기록하고, 과거 기록을 조회한다. 모든 쓰기는 먼저 기기의 IndexedDB에 저장하고(오프라인 우선), 홈서버의 SQLite가 기준 사본이 되도록 자동 동기화한다.

기술 접근은 사용자의 기존 `todo-app`(`~/Documents/todo-app`)을 그대로 따른다: TypeScript 전용, 서버·클라이언트가 공유하는 순수 로직(`shared/`), Node 내장 SQLite, esbuild 번들, 레코드 단위 HLC+LWW 동기화(서버 `seq` 커서, 멱등 push, SSE 알림), 일회용 코드 기기 페어링, Caddy 내부 CA TLS와 systemd. 알림(Web Push)과 구글 캘린더는 이 앱에 없으므로 가져오지 않는다. 결정과 todo-app과의 차이는 [research.md](./research.md)에 있다.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict). 서버는 Node.js ≥ 22.18에서 type stripping으로 직접 실행(erasable syntax만 사용), 배포 서버는 Node 24 LTS. 클라이언트는 ES2022.

**Primary Dependencies**: 런타임 의존성 0 (서버는 `node:sqlite`, `node:http`, `node:crypto` 등 내장만). 개발 의존성: `typescript`, `esbuild`, `@playwright/test`, `@axe-core/playwright`, `fake-indexeddb`, `@types/node`. 인프라: Caddy.

**Storage**: 서버 SQLite(`node:sqlite`, WAL, `/var/lib/fitness/fitness.db`, `PRAGMA user_version` 마이그레이션). 클라이언트 IndexedDB(버전 관리). 기기 위치/탭 같은 UI 상태만 `localStorage`.

**Testing**: `node --test`로 shared·server·client 단위/계약 테스트, Playwright로 사용자 스토리별 E2E(오프라인 시나리오 포함)와 axe 접근성 점검.

**Target Platform**: 모바일 브라우저(iOS Safari 홈 화면 PWA 우선)와 데스크톱 브라우저. 서버는 홈서버의 Debian 12/Ubuntu 24.04 LXC.

**Project Type**: web-service + PWA (서버 / 클라이언트 / 공유 로직 3개 디렉터리)

**Performance Goals**: 한 세트 기록 5초 이내(SC-001), 세션 500개 기준 기록 목록 1초 이내(SC-005), 입력→화면 반영은 로컬 우선이라 100ms 이내 목표.

**Constraints**: 오프라인에서 모든 기록 기능 동작, 앱 재실행 후 진행 중 세션 복원, 동기화는 멱등·무손실, 외부 서비스 의존 없음, 출력은 `textContent`로만(innerHTML 금지).

**Scale/Scope**: 사용자 1명, 기기 2~4대, 세션 수천 건 이하, 화면 약 8개(루틴 목록/편집, 종목 선택, 세션 진행, 세션 요약, 기록 목록/상세, 종목 이력, 설정).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 내용 | 결과 |
|---|---|---|
| I. 직관적 UX 우선 | 모바일 우선, 직전 값 자동 채움 + 한 번 탭으로 세트 완료(FR-006, SC-001), 큰 터치 영역, 라이트/다크 토큰, 모든 화면에 로딩·빈·오류 상태(FR-015) | ✅ |
| II. 데이터 무결성과 소유권 | 입력 즉시 IndexedDB 트랜잭션 후에만 성공 표시, 진행 중 세션 복원(FR-009), 멱등 동기화(FR-016), 서버 복원 감지, 마이그레이션 경로(서버 `user_version`·IndexedDB 버전), 내보내기와 전체 삭제(FR-014) | ✅ |
| III. 가이드 콘텐츠 정확성 | 이 기능의 범위 밖(기능 2). 종목 엔티티에 `bodyPart`를 두어 연결 지점만 남긴다 | ✅ (해당 없음) |
| IV. 데이터 기반 성장 시각화 | 차트는 범위 밖(기능 3). 단, 총 볼륨 등 계산은 UI와 분리된 순수 함수(`shared/volume.ts`)로 두고 단위 테스트한다. 세션 요약과 종목 이력이 이를 재사용 | ✅ |
| V. 네이티브 확장 + 프라이버시 | HealthKit·Watch는 범위 밖. 플랫폼 기능은 어댑터 뒤에 둔다는 원칙에 따라 이 기능은 네이티브 API를 쓰지 않는다. 데이터는 홈서버에만 저장하고 외부 전송·분석 이벤트 없음 | ✅ |
| 기술/플랫폼 제약 | TypeScript, 프레임워크·저장소 선택을 research에 근거와 함께 기록, 새 의존성 없음, 모바일 중급 기기 성능 목표, WCAG 2.1 AA(axe + 320px E2E) | ✅ |
| 개발 워크플로 | Spec Kit 흐름 준수. 도메인 로직(검증·볼륨·병합·직전값)은 테스트를 먼저 작성, 핵심 흐름(루틴→세션→조회)은 Playwright E2E. `npm run lint`(tsc + 금지 API 검사), `npm test`, `npm run test:e2e` 통과가 병합 조건. MVP 범위 한정(차트·가이드·HealthKit 제외) | ✅ |

**Post-design 재확인 (Phase 1 이후)**: data-model·contracts·quickstart를 대조했다.
- 런타임 의존성은 0이다.
- 레코드는 4종(exercise, routine, session, settings)이며 세션은 세트를 내장한 레코드 하나라 동기화가 단순하다.
- 단위(kg/lb)는 kg로 저장하고 표시만 변환해 SC-006(입력값=표시값)을 지킨다.
- 위반 사항은 없다. **GATE 통과.**

## Project Structure

### Documentation (this feature)

```text
specs/001-routine-workout-logging/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── sync-api.md      # 동기화 HTTP API
│   └── admin-cli.md     # 서버 관리 CLI
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
shared/                      # 서버·클라이언트 공용 순수 로직 (런타임 의존성 없음)
├── hlc.ts                   # 하이브리드 논리 시계
├── merge.ts                 # 레코드 병합(LWW)
├── model.ts                 # 타입 정의와 검증(교차 규칙 포함)
├── volume.ts                # 세트·세션 볼륨, 운동 시간, 요약
├── units.ts                 # kg/lb 변환과 표시 반올림
├── prefill.ts               # 종목별 직전 세션 값 계산
├── seed-exercises.ts        # 기본 운동 종목 목록
├── export.ts                # 내보내기 형식
└── tests/

server/
├── src/
│   ├── main.ts              # HTTP 서버 진입점
│   ├── http.ts              # 라우팅·공통 헤더·오류 형식
│   ├── api.ts               # /api/health, /api/devices/me
│   ├── sync.ts              # /api/changes (push/pull)
│   ├── events.ts            # /api/events (SSE)
│   ├── auth.ts              # 기기 페어링·세션 쿠키
│   ├── db.ts                # SQLite 접근
│   ├── migrations.ts
│   └── admin-cli.ts         # fitness-admin
└── tests/ (contract, unit, fixtures, helpers)

client/
├── src/
│   ├── main.ts, app.ts      # 진입점, 라우팅
│   ├── store/               # IndexedDB: exercises, routines, sessions, settings, meta
│   ├── sync/                # engine.ts, events.ts, status.ts
│   ├── ui/                  # 화면과 공통 컴포넌트 (textContent만 사용)
│   ├── routines.ts          # 루틴 도메인 동작
│   ├── sessions.ts          # 세션 진행·종료·복원
│   ├── history.ts           # 기록·종목 이력 조회
│   ├── settings.ts
│   ├── export.ts
│   ├── styles.css           # 디자인 토큰, 라이트/다크
│   └── sw.ts                # 서비스 워커(앱 셸 캐시)
├── public/                  # index.html, manifest, 아이콘
└── tests/

e2e/                         # Playwright 수용 테스트 (스토리별)
deploy/                      # Caddyfile, fitness.service, install.sh
scripts/                     # build.mjs, lint.mjs
package.json, tsconfig.json, playwright.config.ts
```

**Structure Decision**: todo-app과 같은 `shared/ + server/ + client/` 구성을 쓴다. 병합·검증·볼륨·단위 변환처럼 서버와 클라이언트가 같은 결과를 내야 하는 규칙을 `shared/`에 한 번만 구현하기 위해서다. 이후 기능 2(가이드 미디어)와 3(차트)은 `client/src/ui`, `shared/`에 모듈을 더하는 방식으로 확장한다.

## Complexity Tracking

위반 사항이 없어 작성하지 않는다. (`node:sqlite`가 대상 Node에서 플래그 없이 동작하지 않으면 `better-sqlite3`를 유일한 런타임 의존성으로 추가하고 여기에 기록한다. research R3.)
