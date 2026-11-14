# Tasks: 휴식 종료 알림

- [X] T001 [P] todo-app 에서 웹 푸시 테스트를 가져온다(먼저): `server/tests/fixtures/rfc8291-appendix-a.json`, `server/tests/helpers/fake-push-service.ts`, `server/tests/unit/webpush.test.ts`
- [X] T002 `server/src/vapid.ts`, `server/src/webpush.ts` 가져오기 (T001 통과)
- [X] T003 [P] `server/tests/contract/push.test.ts`(먼저): 공개키, 구독 등록(허용 안 된 주소·잘못된 키 400), 켜기/끄기, 삭제, 테스트 푸시(가짜 서비스로 복호화해 `{v:1,test:true}` 확인), `rest-alarm` 예약·바꾸기·취소, 시각 범위 검증, 만기 시 푸시 1회·예약 삭제, 꺼진 구독은 보내지 않음, 410 이면 구독 삭제, 해제한 기기는 구독·예약 삭제, 2분 넘게 지난 예약은 보내지 않음
- [X] T004 `server/src/migrations.ts` v2, `server/src/push-api.ts`, `server/src/scheduler.ts`, `server/src/api.ts`(추가 라우트), `server/src/auth.ts`(해제 시 삭제), `server/src/main.ts`(연결, 환경 변수) (T003 통과)
- [X] T005 [P] `client/tests/notify.test.ts`, `client/tests/rest-alarm.test.ts`, `client/tests/sw-notify.test.ts`(먼저): 상태 판정(설치 필요·미연결·거부·미지원·켜짐/꺼짐), 켜기 흐름, 타이머 시작·재개·조절 → PUT(끝나는 시각), 일시정지·정지·완료 → DELETE, 미연결이면 요청 없음·네트워크 오류 무시, 서비스 워커는 항상 알림을 띄우고 클릭하면 `#/session`
- [X] T006 `client/src/notify.ts`, `client/src/rest-alarm.ts`, `client/src/rest-timer.ts`(끝나는 시각 노출, 변경 알림), `client/src/ui/rest-timer-bar.ts`·`session-screen.ts` 연결, `client/src/sw-notify.ts`·`sw.ts` (T005 통과)
- [X] T007 `client/src/ui/settings.ts` 휴식 알림 섹션(상태 안내, 켜기, 끄기, 테스트 알림)
- [X] T008 [P] `e2e/rest-notification.spec.ts`: 페어링한 기기에서 세트 완료 → `PUT /api/rest-alarm`, 일시정지 → `DELETE`, 재개 → `PUT`, 세션 종료 → `DELETE`. 설정 화면이 미연결·미지원 상태를 안내
- [X] T009 `deploy/fitness.service`(아웃바운드 허용, `FITNESS_VAPID_FILE`), `deploy/install.sh` 안내 문구, `fitness-admin push-test <deviceId>`(서버에서 직접 확인)
- [X] T010 `npm run lint`·`npm test`·`npm run test:e2e` 전체 통과, 배포 후 실기기 확인 항목 정리

## 배포 후 실기기 확인 (T010)

1. 서버: `cd ~/fitness-app && git pull && sudo FITNESS_SKIP_CADDYFILE=1 deploy/install.sh` (유닛 파일이 바뀌어 아웃바운드가 열린다)
2. iPhone 홈 화면 앱 → 설정 → 휴식 알림 → **알림 켜기** → 권한 허용 → "켜져 있어요"
3. **테스트 알림** → 잠금 화면에 "테스트 알림이에요"가 뜬다 (안 오면 서버에서 `fitness-admin devices` → `fitness-admin push-test <deviceId>` 로 응답 코드 확인)
4. 운동 진행 → 세트 완료 → 화면을 끈다 → 휴식이 끝난 뒤 몇 초 안에 "휴식 끝 · 다음 세트를 시작하세요" 알림
5. 휴식 중 일시정지하거나 세션을 끝낸 뒤 화면을 끈다 → 알림이 오지 않는다
6. 알림을 누르면 운동 진행 화면이 열린다
