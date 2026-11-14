# Contract: 동기화 API 변경 (guideNote)

기능 1의 [sync-api.md](../../001-routine-workout-logging/contracts/sync-api.md)를 그대로 쓴다. 엔드포인트·인증·오류 형식·멱등성 규칙은 바뀌지 않는다. 바뀌는 것은 레코드 종류 하나뿐이다.

## `POST /api/changes`, `GET /api/changes`

- `type`에 `"guideNote"`가 추가된다. 다섯 종류가 하나의 `seq` 번호 공간을 공유한다.
- `guideNote` 레코드는 [data-model.md](../data-model.md#guidenote-사용자-가이드-노트--동기화-레코드-type-guidenote)의 필드를 담는다.
- 서버 검증은 `shared/model.ts`의 `validateRecord('guideNote', …)`를 쓴다. 클라이언트와 같은 규칙이다.
  - `id`가 UUID가 아니거나 **기본 종목 id**이면 `{field: "id", rule: "builtin_exercise"}`.
  - `cues`·`mistakes`: 10개 초과면 `max`, 항목이 공백 제거 후 0자 또는 200자 초과면 `length`.
  - 근육: 목록에 없는 값은 `enum`, 중복은 `duplicate`, 주동근과 보조근이 겹치면 `overlap`, 6개 초과면 `max`.
  - 알 수 없는 필드는 `unknown_field`.
- 툼스톤(`deleted=true`)은 공통 필드만 있어도 받는다(기능 1과 동일).

서버 SQLite 스키마는 바뀌지 않는다(`records.type`에 새 값만 들어간다).

## 이전 버전 클라이언트와의 호환

- 업데이트 전 클라이언트(기능 1만 있는 버전)는 pull에서 `guideNote`를 받으면 모르는 type으로 보고 **건너뛴다**(기능 1 엔진 `applyPage`가 `RECORD_TYPES`에 없는 type을 무시한다). 그래도 cursor는 전진한다.
- 그 클라이언트가 나중에 업데이트되면 cursor가 이미 지나 있어 노트를 받지 못할 수 있다. 그래서 **v2 클라이언트는 IndexedDB를 v1→v2로 업그레이드할 때 cursor를 0으로 되돌려 한 번 전체 pull 한다**(LWW라 결과는 같고 비용은 작다).

## 계약 테스트 추가 (`server/tests/contract/guide-note.test.ts`)

1. 직접 만든 종목 id로 된 `guideNote`를 push → pull하면 같은 레코드가 나온다.
2. 기본 종목 id로 된 `guideNote`는 400 `builtin_exercise`이고, 같이 보낸 다른 레코드도 롤백된다.
3. 요점 11개, 201자 항목, 공백뿐인 항목, 모르는 근육, 주동근·보조근 겹침, 근육 중복은 400.
4. `guideNote` 툼스톤(최소 필드)을 push하면 이후 pull에 `deleted=true`로만 나온다.
5. `fitness-admin export`에 `version: 2`와 살아 있는 `guideNotes`가 포함되고, 툼스톤은 빠진다.
