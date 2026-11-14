# Implementation Plan: 운동 가이드 (텍스트)

**Branch**: `002-exercise-guide` | **Date**: 2026-11-14 (범위 축소 반영) | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-exercise-guide/spec.md`

## Summary

기본 종목 35개에 텍스트 가이드(자세 요점·흔한 실수·주동근·보조근)를 붙이고 세 곳에서 연다.
- 운동 진행 화면의 ⓘ
- 종목 선택
- 새 "가이드" 탭

직접 만든 종목에는 가이드 노트를 쓰고 동기화한다.

**범위 변경 이력**: 처음 계획한 인체 모델 동작 애니메이션과 3D 보기는 사용자 결정으로 뺐다. 그 기반 코드(`shared/body/*`의 뼈대·FK·투영·기구, `client/src/ui/guide/renderer.ts`)는 지운다. 근육 목록만 남겨 `shared/muscles.ts`로 옮긴다. 지연 로딩 청크와 서비스 워커 사전 캐시(빌드)는 가이드 데이터에 그대로 쓴다.

기술 접근:
- **기본 가이드 데이터**: `shared/guides.ts`에 둔다. 클라이언트가 `import()`로 지연 로딩하고, 서비스 워커가 미리 캐시해 오프라인에서도 보인다.
- **노트**: 새 레코드 종류 `guideNote`를 쓰고 id는 종목 id와 같다. 기능 1의 동기화·내보내기·전체 삭제를 그대로 쓴다. 서버 스키마는 바뀌지 않는다.
- **가이드 표시**: 하나의 컴포넌트를 쓴다. 진행 화면과 종목 선택에서는 대화상자로, 가이드 탭에서는 전체 화면으로 연다.

## Technical Context

**Language/Version**: TypeScript 5.9, 기능 1과 같다.

**Primary Dependencies**: 런타임 의존성 0. 새 개발 의존성도 없다.

**Storage**:
- 기본 가이드는 앱 번들의 지연 로딩 청크에 둔다.
- 노트는 IndexedDB 새 store `guideNotes`(DB 버전 1→2)와 서버 `records` 테이블(`type='guideNote'`)에 저장한다.

**Testing**:
- `node --test`: 콘텐츠 무결성(35개 전부, 개수·길이·근육·겹침), 노트 검증, 계약, 동기화, DB 업그레이드
- Playwright E2E: 스토리별, axe(두 테마)·320px

**Target Platform / Project Type**: 기능 1과 같다.

**Performance Goals**: 가이드를 1초 이내에 연다(SC-003). 데이터는 텍스트 수십 KB다.

**Constraints**: 오프라인에서 항상 보여야 하고, 출력은 `textContent`로만 하며, 색에만 의존하지 않는다.

**Scale/Scope**:
- 기본 가이드 35개, 근육 17종
- 화면: 가이드 탭, 가이드 화면·대화상자, 노트 편집, 그리고 기존 화면 두 곳의 진입 버튼
- 하단 탭이 4개(루틴·기록·가이드·설정)가 된다.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 확인 내용 | 결과 |
|---|---|---|
| I. 직관적 UX 우선 | 운동 중 ⓘ → 닫기 2탭으로 기록에 복귀한다(SC-001). 모바일 우선, 320px, 로딩·빈·오류 상태를 둔다 | ✅ |
| II. 데이터 무결성과 소유권 | 노트는 즉시 IndexedDB 트랜잭션으로 저장하고 멱등 동기화한다. DB v1→v2 마이그레이션 경로가 있다. 내보내기 형식을 버전 2로 올리고 노트를 포함하며, 전체 삭제로 함께 지운다 | ✅ |
| III. 가이드 콘텐츠 정확성과 접근성 | 부위별 분류와 자세 요점 텍스트를 제공한다. 데이터는 지연 로딩한다. 미디어가 없으므로 대체 텍스트·대체 이미지 요구는 해당 없다. 콘텐츠 무결성 테스트로 35개 전부를 검증한다 | ✅ |
| IV. 데이터 기반 시각화 | 범위 밖 | ✅ (해당 없음) |
| V. 네이티브 확장 + 프라이버시 | 네이티브 API 없음. 노트는 홈서버에만 저장한다 | ✅ |
| 기술 제약 / 워크플로 | 새 의존성 없음, WCAG 2.1 AA. 검증·콘텐츠는 테스트를 먼저 쓰고, `lint`·`test`·`test:e2e` 통과가 병합 조건이다 | ✅ |

**Post-design 재확인**: 서버 코드 변경은 공유 검증과 CLI 내보내기뿐이다. IndexedDB 업그레이드는 store만 추가하고, 내보내기 v2는 v1 필드를 그대로 유지하는 상위 호환이다. **GATE 통과**.

## Project Structure

```text
shared/
├── muscles.ts               # 근육 17종 (shared/body/muscles.ts 에서 옮기고 그리기 정보는 뺌)
├── guides.ts                # 기본 가이드 35개 + getBuiltinGuide / listBuiltinGuides
├── model.ts                 # 수정: RecordType 'guideNote', GuideNote 검증
├── export.ts                # 수정: 내보내기 v2 (guideNotes)
└── tests/guide-content.test.ts, muscles.test.ts, model.test.ts(추가)
   (삭제: shared/body/ 의 skeleton·pose·camera·props 와 그 테스트)

server/src/admin-cli.ts      # 수정: export 에 guideNotes
server/tests/contract/guide-note.test.ts

client/src/
├── store/db.ts              # 수정: DB_VERSION 2, guideNotes store, v1→v2 에서 cursor 0
├── store/records.ts         # 수정: guideNotes
├── sync/engine.ts           # 수정: guideNote
├── export.ts                # 수정: 노트 포함·전체 삭제
├── guides.ts                # 지연 로딩, resolveGuide, saveGuideNote, listGuideEntries
├── app.ts                   # 수정: 탭 4개
└── ui/
    ├── guide-view.ts        # 가이드 본문(요점·실수·근육·안내·루틴에 추가·작성 버튼)
    ├── guide-sheet.ts       # 대화상자로 열기
    ├── guide-list.ts        # 가이드 탭
    ├── guide-screen.ts      # 전체 화면
    ├── guide-note-editor.ts # 노트 편집
    ├── session-screen.ts    # 수정: 종목 이름 옆 ⓘ
    └── exercise-picker.ts   # 수정: 종목마다 "가이드"
   (삭제: client/src/ui/guide/renderer.ts 와 그 테스트)
```

## Complexity Tracking

위반 사항이 없어 작성하지 않는다.
