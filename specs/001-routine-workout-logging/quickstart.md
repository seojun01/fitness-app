# Quickstart: 검증 시나리오

**Feature**: `001-routine-workout-logging` | 계약: [sync-api.md](./contracts/sync-api.md), [admin-cli.md](./contracts/admin-cli.md) | 모델: [data-model.md](./data-model.md)

이 문서는 기능이 끝까지 동작하는지 확인하는 절차다. 구현 코드는 담지 않는다.

## 사전 준비

- Node.js ≥ 22.18 (`node -v`), 저장소 루트에서 `npm ci`
- 개발 서버: `npm run dev` (빌드 후 `FITNESS_DEV=1`로 `http://localhost:8081` 실행)
- 자동 검사: `npm run lint`, `npm test`, `npm run test:e2e`

## 자동 검증

| 명령 | 기대 결과 |
|---|---|
| `npm run lint` | 타입 오류 0, 금지 API(`innerHTML` 등) 0, 런타임 `dependencies` 비어 있음 |
| `npm test` | shared 단위(hlc, merge, model, volume, units 왕복, prefill), 서버 계약 12개, 클라이언트 동기화 엔진 테스트 통과 |
| `npm run test:e2e` | 아래 V1~V9가 Playwright로 통과하고 axe 위반 0 |

## 수동 검증 (개발 서버 + 브라우저)

기기 등록: `node server/src/admin-cli.ts pair --name "dev"`로 받은 코드를 앱의 연결 화면에 입력한다.

| # | 시나리오 | 기대 결과 | 스토리/요구 |
|---|---|---|---|
| V1 | 루틴 "가슴·삼두"를 만들고 종목 3개 추가 후 저장, 앱 새로고침 | 루틴이 3개 종목과 함께 남아 있다 | US1, FR-001·002 |
| V2 | 종목 순서 변경·삭제 후 저장, 루틴 복제, 루틴 삭제 | 변경 반영, 복제본은 독립, 삭제 후 과거 세션은 유지 | US1, FR-013 |
| V3 | 루틴으로 세션 시작 → 세트 입력 → 종료 | 종료 요약에 운동 시간·완료 세트 수·총 볼륨 표시, 목록에 저장됨 | US2, FR-008 |
| V4 | 같은 종목을 두 번째 세션에서 열기 | 직전 세션 무게·횟수가 미리 채워져 있고 체크 한 번으로 완료 | US2, FR-006, SC-001 |
| V5 | 루틴 없이 빈 세션 시작 → 종목 즉석 추가 | 기록 가능 | US2, FR-004 |
| V6 | 잘못된 값 입력(횟수 0·소수, 무게 음수) | 입력 단계에서 안내 문구가 보이고 저장되지 않는다 | FR-007 |
| V7 | 브라우저를 오프라인으로 전환 후 세트 기록 → 새로고침 | 오류 없이 기록되고, 새로고침 후 진행 중 세션이 복원된다 | US3, FR-009, SC-003 |
| V8 | 오프라인 기록 후 온라인 복귀, 다른 브라우저 프로필(두 번째 기기)에서 확인 | 중복·누락 없이 같은 세션이 보인다 | FR-016, SC-007 |
| V9 | 기록 목록 → 세션 상세 → 세트 수정 → 종목 이력 | 수정이 목록 요약에 반영되고 종목 이력이 날짜순으로 보인다 | US4, FR-010·011 |
| V10 | 설정에서 kg → lb 전환, 45 lb 입력 후 다시 kg/lb 전환 | 표시가 45 lb(입력한 값 그대로)로 유지되고 기록이 일관된다 | FR-012, SC-006 |
| V11 | 설정에서 내보내기, `fitness-admin export` | 두 JSON이 같은 내용(내부 필드 제외) | FR-014 |
| V12 | 설정에서 전체 삭제 | 확인 단계 후 루틴·기록·직접 만든 종목·설정의 내용이 앱과 서버에서 사라진다(`export` 결과에서 빠지고 기본 종목만 남음) | FR-014 |
| V13 | `fitness-admin revoke <id>` 후 그 기기에서 동기화 | 401로 거부되고 앱이 재연결 안내를 보인다 | FR-017 |
| V14 | 서버를 백업에서 복원(cursor 감소) 후 클라이언트 열기 | 로컬 기록이 서버로 다시 올라가 데이터가 유실되지 않는다 | R6 |
| V15 | 320px 폭에서 모든 화면 | 가로 스크롤 없음, 터치 영역 44px 이상 | 헌법 I·IV |

## 성능 확인

- 세션 500개를 심은 데이터로 기록 목록이 1초 이내에 표시되는지 확인한다(SC-005). 자동 확인은 `client/tests/history.test.ts`(IndexedDB 500개)이고, 서버 DB 에 심으려면 `FITNESS_DB=<경로> node scripts/seed-sessions.mjs 500` 후 페어링한 기기로 기록 화면을 연다.
- 이전 기록이 있는 종목에서 세트 하나를 기록하는 데 5초 이내인지 수동 측정한다(SC-001).

## 배포 확인 (홈서버)

1. `sudo deploy/install.sh` 실행 (멱등). `systemctl status fitness`가 active.
2. `https://fitness.home.arpa/api/health`가 `{"ok":true}`.
3. `fitness-admin pair --name "iPhone"` → 폰에서 코드 입력 → 홈 화면에 추가 후 V3·V7·V8 반복.

## 검증 기록 (2026-11-14)

자동으로 검증한 항목(`npm run test:e2e`, chromium·webkit·모바일 뷰포트):

| 시나리오 | 자동 검증 |
|---|---|
| V1·V2 | `e2e/us1-routines.spec.ts` |
| V3·V4·V5·V6·V10 | `e2e/us2-logging.spec.ts` |
| V7·V8·V13 | `e2e/us3-offline.spec.ts` (V8 은 두 번째 브라우저 컨텍스트로 두 번째 기기를 대신함) |
| V9 | `e2e/us4-history.spec.ts` |
| V11·V12 | `e2e/export-erase.spec.ts` |
| V15 | `e2e/a11y.spec.ts` (320px 프로젝트 포함: axe 위반 0, 가로 스크롤 없음, 터치 영역 44px 이상) |

**아직 실제 환경에서 확인하지 못한 항목** (홈서버·실기기가 필요해서 수행하지 않았다):

- V14(서버를 백업에서 복원): 엔진 단위 테스트(`client/tests/sync-engine.test.ts`)로 복원 감지는 검증했지만 실제 백업 복원은 하지 않았다.
- 배포 확인: `deploy/install.sh` 는 문법만 확인했고 실제 LXC 에서 실행하지 않았다. 홈 화면에 설치한 폰에서의 V3·V7·V8 반복도 하지 않았다.
- 성능 SC-001(세트 5초)은 E2E 의 탭 수(2회 이내)로만 확인했다. 실제 체감 시간 측정과 Core Web Vitals(LCP·INP·CLS) 측정은 하지 않았다.
