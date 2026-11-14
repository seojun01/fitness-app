# Contract: 동기화 HTTP API

**Base URL**: `https://fitness.home.arpa` (Caddy가 TLS를 처리하고 `/api/*`를 Node 서버로 넘김)
**형식**: JSON (UTF-8). 타입은 [data-model.md](../data-model.md)를 따른다. todo-app의 동기화 API에서 푸시 알림 부분을 뺀 형태다.

## 공통 규칙

- **인증**: `/api/health`와 `/api/pair`를 뺀 모든 엔드포인트는 쿠키 `fitness_session`이 필요하다. 없거나 모르는 토큰이거나 해제된 기기이면 `401 {"error":"unauthorized"}`. 성공하면 `devices.last_seen_at`을 갱신한다.
- **CSRF**: `POST`/`PUT`/`DELETE`에 `X-Fitness-Client: 1` 헤더가 없으면 `403`.
- **오류 형식**: `{"error":"<code>","message":"<설명>","details"?:[...]}`
- **크기 제한**: 요청 본문 1 MiB 초과 시 `413`.
- **캐시**: 모든 `/api/*` 응답에 `Cache-Control: no-store`. 서비스 워커도 `/api/*`는 캐시하지 않는다.

## `GET /api/health`
인증 없음. `200 {"ok": true}`

## `POST /api/pair`
인증 없음. 일회용 페어링 코드로 기기를 등록한다.

요청: `{ "code": "K7Q2-M9XD", "deviceId": "<UUID v4>" }`

- `201 {"deviceId":"…","deviceName":"iPhone"}` + `Set-Cookie: fitness_session=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=315360000` (`FITNESS_DEV=1`일 때만 `Secure` 제외)
- `400 {"error":"invalid_code"}`: 코드가 틀렸거나 만료·사용됨
- `400 {"error":"invalid_device_id"}`: UUID가 아니거나 이미 등록된 ID
- `429 {"error":"rate_limited"}`: 실패 1분 5회 초과

## `POST /api/changes` (push)

요청:
```json
{ "changes": [ { "type": "exercise" | "routine" | "session" | "settings", "record": { … } } ] }
```
- `changes`는 1~500개. `record`는 data-model의 해당 타입 모든 필드(서버 내부 필드 제외).
- 레코드마다 서버가 `merge(stored, incoming)`을 하고 incoming의 `version`이 더 크면 반영하며 새 `seq`를 매긴다.
- 툼스톤(`deleted=true`)은 `id`, `version`, `updatedBy`만 있어도 받는다(전체 삭제 시 내용은 비운다).
- 전체가 하나의 트랜잭션이다. 하나라도 검증에 실패하면 아무것도 반영하지 않는다.

응답 `200 {"applied":3,"ignored":1,"cursor":1042}` — `ignored`는 서버에 이미 같거나 더 새로운 version이 있어 반영하지 않은 수(오류 아님).
오류: `400 {"error":"validation","details":[{"type":"session","id":"…","field":"entries[0].sets[1].reps","rule":"integer_min_1"}]}`, `401`, `403`, `413`

**멱등성**: 같은 요청을 여러 번 보내도 결과가 같다. 응답을 못 받은 push는 그대로 다시 보낸다.

## `GET /api/changes?since=<cursor>&limit=<n>` (pull)

- `since`: 0 이상 정수(처음은 `0`). `limit`: 기본값·최대값 1000.
- 응답 `200 { "changes": [ { "type": "session", "record": { … } } ], "cursor": 1042, "hasMore": false }`. 네 종류가 `seq` 오름차순으로 섞여 오고 툼스톤도 포함한다. `hasMore`가 true이면 받은 `cursor`로 다시 요청한다.
- 클라이언트는 받은 레코드의 `merge`와 `cursor` 저장을 한 트랜잭션으로 처리한다.
- **서버 복원 감지**: 응답 `cursor`가 클라이언트에 저장된 cursor보다 **작으면** 서버가 백업에서 복원된 것이다. 클라이언트는 모든 로컬 레코드를 dirty로 표시하고 cursor를 0으로 되돌린 뒤 push와 pull을 차례로 한다.

## `GET /api/events` (SSE)

- `Content-Type: text/event-stream`. 연결 직후와 seq가 증가할 때마다 `event: cursor` / `data: {"cursor":1042}`. 25초마다 `: ping`. 기기가 해제되면 서버가 스트림을 닫고 이후 재연결은 401.
- 클라이언트는 받은 cursor가 저장된 값보다 크면 pull한다.

## `GET /api/devices/me`
`200 {"deviceId":"…","deviceName":"iPhone","createdAt":"…"}`

---

## 서버 검증 규칙 (shared/model.ts와 동일)

- 종목·루틴 이름 1~60자, 루틴 `items` ≤ 50, `targetSets` 1~20.
- 세션 `entries` ≤ 50, 항목당 `sets` ≤ 50, `weightKg` 0~1000, `reps` 1~999 정수.
- `status=completed`이면 `endedAt` 필수이고 `endedAt ≥ startedAt`.
- 알 수 없는 `type`이나 알 수 없는 필드는 거부한다.

## 계약 테스트 목록 (`server/tests/contract/`)

**인증·기기**
1. 쿠키 없이 `/api/changes`를 호출하면 401.
2. 해제된 기기의 쿠키로 호출하면 401.
3. 페어링 코드는 한 번만 성공. 같은 코드를 다시 쓰면 400.
4. 만료된 코드는 400. 이미 등록된 `deviceId`는 `invalid_device_id`.
5. `X-Fitness-Client` 헤더가 없는 쓰기 요청은 403.

**동기화**
6. 네 종류의 레코드를 push한 뒤 pull(`since=0`)하면 같은 레코드가 `seq` 순서로 나온다.
7. 같은 id에 version이 더 작은 레코드를 push하면 `ignored=1`이고 저장값은 바뀌지 않는다.
8. 같은 push를 두 번 보내면 두 번째는 `applied=0`.
9. 검증 실패(이름 0자·61자, `reps` 0·소수·1000, `weightKg` 음수·1001, `completed`인데 `endedAt` 없음, `endedAt < startedAt`, 알 수 없는 type)는 400이며 전체가 롤백된다.
10. `limit` 페이지 나누기를 따라가도 레코드가 빠지거나 중복되지 않는다.
11. SSE 연결 중 다른 클라이언트가 push하면 1초 안에 `cursor` 이벤트가 온다. 기기를 해제하면 스트림이 닫힌다.
12. 툼스톤(최소 필드)을 push하면 이후 pull에서 내용 없이 `deleted=true`로만 나온다.
