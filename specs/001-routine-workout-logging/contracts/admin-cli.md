# Contract: 서버 관리 CLI (`fitness-admin`)

홈서버 안에서만 실행한다. 집 밖에서는 VPN으로 접속한 뒤 SSH로 들어가서 실행한다. CLI는 HTTP를 거치지 않고 SQLite DB에 직접 접근한다. 기본 DB 경로는 `/var/lib/fitness/fitness.db`이고 환경 변수 `FITNESS_DB`로 바꿀 수 있다.

| 명령 | 출력 (stdout) | 종료 코드 |
|---|---|---|
| `fitness-admin pair --name <이름>` | `페어링 코드: K7Q2-M9XD (10분간 유효, 1회용)` | 0 / 이름이 비었거나 50자를 넘으면 2 |
| `fitness-admin devices` | 표: `ID  이름  등록 시각  마지막 동기화  상태(활성/해제)` | 0 |
| `fitness-admin revoke <deviceId>` | `해제됨: iPhone (a91e…)` | 0 / 없는 ID이면 1 |
| `fitness-admin export [--out <파일>]` | 서버의 기준 사본을 [내보내기 형식](../data-model.md#내보내기-형식-fr-014)으로 출력. `--out`이 없으면 stdout | 0 |
| `fitness-admin backup <파일>` | SQLite 온라인 백업(서비스를 실행 중이어도 됨) | 0 / 실패하면 1 |

- 페어링 코드는 혼동하기 쉬운 문자(0/O, 1/I/L)를 뺀 대문자와 숫자 8자리다. DB에는 해시만 저장한다.
- 같은 이름으로 다시 페어링해도 새 기기로 등록된다. 이전 기기는 따로 `revoke`해야 한다.
- 서버 설정 환경 변수: `FITNESS_DB`, `HOST`(기본 `127.0.0.1`), `PORT`(기본 `8081`), `FITNESS_DEV`(1이면 Secure 쿠키 제외).
