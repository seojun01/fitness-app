# Implementation Plan: 휴식 종료 알림

**Branch**: `006-rest-end-notification` | **Date**: 2026-11-15 | **Spec**: [spec.md](./spec.md)

## Summary

todo-app 의 웹 푸시 구현을 가져와 재사용한다: RFC 8291 암호화, VAPID, 공식 테스트 벡터, 허용 호스트 검사, 구독 API, 서비스 워커 처리. 거기에 휴식 종료 예약을 더한다.
- 앱은 휴식 타이머 상태가 바뀔 때 `PUT /api/rest-alarm {endsAt}` 또는 `DELETE` 를 보낸다.
- 서버는 1초마다 만기 예약을 꺼내 그 기기에 푸시를 보낸다.
- 서비스 워커가 "휴식 끝" 알림을 띄우고, 누르면 `#/session` 을 연다.

## Technical Context

- **언어·의존성**: 기능 1~5와 같다. 런타임 의존성 0을 유지한다(`node:crypto`).
- **저장**: 서버 마이그레이션 v2에서 `push_subscriptions`, `rest_alarms` 테이블을 만든다. VAPID 키는 `/var/lib/fitness/vapid.json`(0600)에 둔다.
- **API**:
  - `GET /api/push/key`
  - `PUT/DELETE /api/devices/me/push`
  - `POST /api/push/test`
  - `PUT/DELETE /api/rest-alarm`
- **배포**:
  - `deploy/fitness.service` 에서 `IPAddressDeny=any` 를 지워 애플 푸시 서버로 나가는 연결을 허용한다.
  - 환경 변수 `FITNESS_VAPID_FILE` 을 추가한다.
  - `FITNESS_VAPID_SUBJECT` 기본값은 `https://fitness.home.arpa` 다(사용자 이메일을 외부로 보내지 않음).
- **테스트**:
  - RFC 8291 부록 A 벡터(todo-app 의 픽스처를 그대로 사용)
  - 가짜 푸시 서비스로 API·스케줄러 계약 테스트
  - 클라이언트 예약 호출 단위 테스트
  - E2E: 페어링한 기기에서 타이머 조작이 `rest-alarm` 요청을 보냄, 설정 화면 안내

## Constitution Check

| 원칙 | 확인 | 결과 |
|---|---|---|
| I. UX | 알림을 누르면 진행 화면으로 간다. 설정에 받을 수 없는 이유와 해결 방법을 안내한다 | ✅ |
| II. 데이터 | 예약·구독은 기기 상태라 동기화 레코드가 아니다. 기록 데이터에는 영향이 없다 | ✅ |
| V. 프라이버시 | 외부(푸시 서비스) 전송은 사용자가 요청한 기능이다. 페이로드는 일반 문구와 종류뿐이고 RFC 8291 로 암호화한다. VAPID subject 는 사용자 이메일이 아니다. 허용 호스트로만 보낸다(SSRF 방지) | ✅ |
| 기술·워크플로 | 새 의존성 없음. 암호화는 공식 벡터 테스트를 먼저 둔다(가져온 테스트) | ✅ |

## Project Structure

```text
server/src/{vapid,webpush}.ts      # todo-app 에서 가져옴 (환경 변수 이름만 바꿈)
server/src/push-api.ts             # 구독·테스트·rest-alarm 라우트
server/src/scheduler.ts            # 1초 간격 휴식 알림 발송
server/src/migrations.ts           # v2: push_subscriptions, rest_alarms
server/src/auth.ts                 # revoke 때 구독·예약 삭제
client/src/notify.ts               # 권한·구독·서버 등록 (todo-app 에서 가져와 시간대 제거)
client/src/rest-alarm.ts           # 타이머 상태 → 서버 예약/취소
client/src/sw-notify.ts, sw.ts     # push → "휴식 끝" 알림, 클릭 → #/session
client/src/ui/settings.ts          # 휴식 알림 섹션
```
