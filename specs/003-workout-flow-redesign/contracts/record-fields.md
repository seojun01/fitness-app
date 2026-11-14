# Contract: 레코드 필드 추가 (동기화 계약 변경분)

기능 1의 [sync-api.md](../../001-routine-workout-logging/contracts/sync-api.md)는 그대로다. 엔드포인트·인증·멱등성·형식은 바뀌지 않는다.

## 검증 규칙 추가 (`validateRecord`, 서버·클라이언트 공통)

| type | 필드 | 규칙 | 오류 |
|---|---|---|---|
| `exercise` | `memo` | 선택. 있으면 문자열, 0~500자(코드 포인트) | `{field: "memo", rule: "length"}` |
| `settings` | `restSeconds` | 선택. 있으면 정수, 15~600, 15의 배수 | `{field: "restSeconds", rule: "range"}` |

- 이전 버전 클라이언트가 보낸 레코드(필드 없음)는 그대로 유효하다.
- 새 버전 클라이언트가 보낸 레코드를 **이전 버전 서버**가 받으면 `unknown_field`로 거부한다. 그래서 배포는 **서버를 먼저**(또는 동시에) 올린다. 홈서버는 앱 파일과 서버를 `install.sh` 한 번으로 함께 올리므로 같은 시점에 바뀐다.

## 내보내기

- 형식 `fitness-export` 버전은 1 그대로다. 종목에 `memo`, 설정에 `restSeconds`가 있으면 그대로 포함된다(필드 추가, 상위 호환).

## 계약 테스트 추가 (`server/tests/contract/sync.test.ts`)

1. `memo`가 있는 종목, `restSeconds`가 있는 설정을 push → pull하면 같은 값이 나온다.
2. `memo` 501자, `restSeconds` 10·601·50(15의 배수 아님)·문자열은 400이고 롤백된다.
3. 두 필드가 없는 레코드도 계속 받는다.
