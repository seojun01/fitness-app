# Implementation Plan: 운동 가이드 (부위별 동작 애니메이션)

**Branch**: `002-exercise-guide` | **Date**: 2026-11-14 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-exercise-guide/spec.md`

## Summary

기본 종목 35개 각각에 가이드를 붙인다. 가이드는 자세 요점, 흔한 실수, 주동근·보조근 설명과 내장 인체 모델로 그린 반복 동작 애니메이션으로 이뤄진다. 직접 만든 종목에는 사용자가 설명 글만 쓰고 동기화한다.

기술 접근:
- **인체 모델**: 관절 17개짜리 뼈대를 정방향 운동학(FK)으로 계산한다. 각 동작은 "키프레임(관절 회전) + 주기"로 정의하고, 여러 종목이 소수의 **동작 템플릿**(누르기, 당기기, 스쿼트, 힌지, 컬 등)을 매개변수만 바꿔 공유한다.
- **렌더링**: 포즈를 종목별 고정 시점(정면·측면 등)의 직교 투영으로 Canvas 2D에 그리고, 앞뒤가 맞도록 깊이 순으로 정렬한다. 3D 보기는 범위에서 뺐다(2026-11-14 변경). WebGL·three.js 같은 의존성은 없다(런타임 의존성 0 유지).
- **데이터**: 기본 가이드는 별도 청크로 지연 로딩한다. 서비스 워커는 빌드 산출물 전부를 미리 캐시하므로 처음부터 오프라인에서 보인다.
- **사용자 가이드 노트**: 새 레코드 종류 `guideNote`로 기능 1의 동기화(HLC+LWW, `seq`)에 그대로 얹는다. 서버는 스키마 변경 없이 `type` 하나만 늘어난다.
- **화면**: 가이드는 하나의 컴포넌트로 만든다. 세션·종목 선택에서는 **대화상자(시트)**로 열어 원래 화면 상태를 건드리지 않고(FR-005), 가이드 탭에서는 전체 화면으로 연다.

결정 근거는 [research.md](./research.md)에 있다.

## Technical Context

**Language/Version**: TypeScript 5.9 (strict), 기능 1과 같다. 서버는 Node ≥ 22.18, 클라이언트는 ES2022.

**Primary Dependencies**: 런타임 의존성 0을 유지한다. 그리기는 Canvas 2D와 직접 구현한 직교 투영으로 한다. 개발 의존성은 기능 1과 같고 새로 추가하지 않는다.

**Storage**:
- 기본 가이드는 앱 번들(지연 로딩 청크)에 들어간다.
- 사용자 가이드 노트는 IndexedDB 새 store `guideNotes`(DB 버전 1→2)와 서버 `records` 테이블(`type='guideNote'`)에 저장한다.

**Testing**:
- `node --test`: FK·보간·투영 수학, 가이드 콘텐츠 무결성(35개 전부, 개수·근육·루프 연속성), 노트 검증, 동기화 계약
- Playwright E2E: 스토리별 테스트, `emulateMedia({ reducedMotion: 'reduce' })`, axe·320px 점검

**Target Platform**: 기능 1과 같다. 모바일 브라우저(iOS Safari PWA 우선)와 데스크톱.

**Project Type**: 기능 1의 web-service + PWA 구조를 확장한다.

**Performance Goals**:
- 가이드를 연 뒤 1초 이내에 첫 프레임을 그린다(SC-002).
- 중급 모바일 기기에서 60fps 목표로 끊김 없이 그린다(SC-005). 프레임마다 관절 17개 FK와 선분 약 20개를 그리는 정도라 충분하다.
- 초기 번들은 가이드 데이터만큼 늘지 않는다(지연 로딩).

**Constraints**:
- 오프라인에서 모든 기본 가이드가 보인다(FR-010).
- 동작 줄이기 설정을 존중한다(FR-003).
- 색에만 의존하지 않는다(FR-004).
- 출력은 `textContent`로만 하고, canvas에는 `role="img"`와 대체 텍스트를 둔다(FR-015).

**Scale/Scope**:
- 기본 가이드 35개, 동작 템플릿 약 12개, 근육 17종
- 화면: 가이드 목록, 가이드 보기, 가이드 노트 편집 + 기존 화면 2곳의 진입 버튼
- 하단 탭이 4개(루틴·기록·가이드·설정)가 된다.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 내용 | 결과 |
|---|---|---|
| I. 직관적 UX 우선 | 운동 중 가이드를 시트로 열고 닫아 탭 2회 이내에 기록으로 돌아온다(SC-001). 모바일 우선 세로 배치, 320px에서 가로 스크롤 없음, 큰 조작 버튼, 로딩·빈·오류 상태를 둔다 | ✅ |
| II. 데이터 무결성과 소유권 | 가이드 노트는 즉시 IndexedDB 트랜잭션으로 저장하고 멱등 동기화한다. DB 버전 1→2와 내보내기 형식 버전 1→2에 마이그레이션 경로를 둔다. 내보내기에 포함하고 전체 삭제로 함께 지운다(FR-016) | ✅ |
| III. 가이드 콘텐츠 정확성과 접근성 | 부위별 분류와 자세 요점 텍스트를 함께 제공한다. 가이드 데이터는 지연 로딩(별도 청크)하고 외부 미디어가 없어 압축 이슈도 없다. canvas를 못 쓰면 동작 설명 글과 텍스트 가이드로 대체한다. 모든 그림에 대체 텍스트를 둔다. 콘텐츠 무결성 테스트로 35개 전부를 검증한다 | ✅ |
| IV. 데이터 기반 성장 시각화 | 범위 밖(기능 3) | ✅ (해당 없음) |
| V. 네이티브 확장 + 프라이버시 | 네이티브 API를 쓰지 않는다. 가이드 노트는 홈서버에만 저장한다. 외부 전송은 없다 | ✅ |
| 기술/플랫폼 제약 | TypeScript, 새 의존성 없음(그리기 라이브러리 대신 직접 구현, 근거 G2), WCAG 2.1 AA(axe + 320px) | ✅ |
| 개발 워크플로 | Spec Kit 흐름을 따른다. 수학·콘텐츠·검증은 테스트를 먼저 쓰고, 핵심 흐름(세션 중 가이드 열고 닫기)은 E2E로 검증한다. `lint`·`test`·`test:e2e`가 병합 조건이다 | ✅ |

**Post-design 재확인**:
- 런타임 의존성은 0이고, 서버 스키마 변경이 없다(`type`만 추가).
- IndexedDB 업그레이드(v1→v2)는 기존 store를 건드리지 않고 store만 추가한다. 내보내기 v2는 v1 필드를 그대로 유지하는 상위 호환이다.
- 위반 사항이 없어 **GATE 통과**.

## Project Structure

### Documentation (this feature)

```text
specs/002-exercise-guide/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sync-api-delta.md     # 기능 1 동기화 API에 추가되는 guideNote
│   └── guide-content.md      # 기본 가이드·동작 정의 형식(앱 내부 계약)
├── checklists/requirements.md
└── tasks.md                  # /speckit-tasks
```

### Source Code (repository root)

```text
shared/
├── body/
│   ├── skeleton.ts          # 관절 계층, 뼈 길이, 관절 가동 범위
│   ├── pose.ts              # 포즈 타입, 보간(이징), FK → 관절 월드 좌표
│   ├── camera.ts            # 직교 투영, 시점 프리셋(정면·측면·후면·비스듬히)
│   ├── muscles.ts           # 근육 목록(17종) ↔ 강조할 뼈 구간, 한국어 이름
│   └── props.ts             # 기구(바벨·덤벨·벤치·철봉·케이블·바닥) 정의
├── guides/
│   ├── templates.ts         # 동작 템플릿(누르기·당기기·스쿼트·힌지·컬·...) → 키프레임
│   ├── content.ts           # 기본 종목 35개의 글(요점·실수·근육) + 템플릿 매개변수
│   └── index.ts             # getBuiltinGuide(exerciseId), listBuiltinGuides()
├── model.ts                 # (수정) RecordType에 'guideNote', GuideNote 검증 추가
├── export.ts                # (수정) 내보내기 v2: guideNotes
└── tests/                   # skeleton·pose·camera·templates·content·guide-note 테스트

server/                      # 코드 변경 없음(shared 검증을 그대로 쓴다). 계약 테스트만 추가
└── tests/contract/guide-note.test.ts

client/src/
├── store/db.ts              # (수정) DB_VERSION 2, guideNotes store
├── store/records.ts         # (수정) guideNotes 읽기·쓰기
├── sync/engine.ts           # (수정) STORE_OF에 guideNote
├── export.ts                # (수정) 내보내기·전체 삭제에 guideNotes
├── guides.ts                # 가이드 조회(기본+노트 합치기), 노트 저장·삭제
├── ui/guide/
│   ├── renderer.ts          # Canvas 2D 그리기(뼈·관절·근육 강조·기구), 깊이 정렬
│   ├── player.ts            # 재생 루프(rAF), 일시정지·속도·동작 줄이기
│   ├── guide-view.ts        # 가이드 본문 컴포넌트(플레이어 + 글 + 루틴에 추가)
│   └── guide-sheet.ts       # 대화상자로 열기 (세션·종목 선택에서)
├── ui/guide-list.ts         # 가이드 탭: 부위 필터·검색·정지 미리보기
├── ui/guide-screen.ts       # 전체 화면 가이드
├── ui/guide-note-editor.ts  # 직접 만든 종목의 가이드 글 작성
├── ui/session-screen.ts     # (수정) 종목마다 "가이드" 버튼
└── ui/exercise-picker.ts    # (수정) 종목마다 "가이드" 버튼

scripts/build.mjs            # (수정) splitting + 산출물 목록을 SW 사전 캐시에 주입
e2e/                         # us1~us5-guide*.spec.ts, a11y 확장
```

**Structure Decision**: 기능 1의 `shared/ + server/ + client/` 구조를 그대로 확장한다.
- 인체 모델·투영·동작 정의는 순수 함수라 `shared/`에 둔다. UI 없이 단위 테스트할 수 있고, 기능 3이나 이후 네이티브 래퍼에서도 다시 쓸 수 있다.
- 그리기와 재생만 `client/src/ui/guide/`에 둔다.

## Complexity Tracking

위반 사항이 없어 작성하지 않는다. 그리기 라이브러리를 쓰지 않는 결정은 원칙(의존성 최소)을 따르는 쪽이라 정당화 대상이 아니다. 대안과 위험은 research G2에 적었다.
