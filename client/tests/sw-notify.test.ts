import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REST_BODY, REST_TITLE, SESSION_URL, TEST_TITLE, handleNotificationClick, handlePush, type NotifySw, type SwWindowClient } from '../src/sw-notify.ts';

function makeSw(windows = 0) {
  const shown: { title: string; options: Record<string, unknown> }[] = [];
  const opened: string[] = [];
  const messages: unknown[] = [];
  const focused: number[] = [];
  const clients: SwWindowClient[] = Array.from({ length: windows }, (_, i) => ({
    url: 'http://localhost/',
    focus: async () => void focused.push(i),
    postMessage: (m: unknown) => void messages.push({ to: i, ...(m as object) }),
  }));
  const sw: NotifySw = {
    clients: { matchAll: async () => clients, openWindow: async (url) => void opened.push(url) },
    registration: { showNotification: async (title, options) => void shown.push({ title, options }) },
  };
  return { sw, shown, opened, messages, focused };
}

test('휴식 끝 푸시: 운동 내용 없는 일반 문구로 알림을 띄우고, tag 로 합치되 다시 울린다', async () => {
  const m = makeSw();
  await handlePush(m.sw, () => ({ v: 1, kind: 'rest-end' }));
  assert.equal(m.shown.length, 1);
  assert.equal(m.shown[0]!.title, REST_TITLE);
  assert.equal(REST_TITLE, '휴식 끝');
  assert.equal(m.shown[0]!.options.body, REST_BODY);
  assert.equal(m.shown[0]!.options.tag, 'rest-end');
  assert.equal(m.shown[0]!.options.renotify, true);
});

test('테스트 푸시는 테스트 문구로 띄운다', async () => {
  const m = makeSw();
  await handlePush(m.sw, () => ({ v: 1, test: true }));
  assert.equal(m.shown[0]!.title, TEST_TITLE);
  assert.equal(m.shown[0]!.options.tag, 'test');
});

test('해석할 수 없는 페이로드여도 알림은 항상 띄운다 (iOS 규칙)', async () => {
  for (const read of [() => { throw new SyntaxError('bad'); }, () => undefined, () => 'text', () => null]) {
    const m = makeSw();
    await handlePush(m.sw, read);
    assert.equal(m.shown.length, 1);
    assert.equal(m.shown[0]!.title, REST_TITLE);
  }
});

test('알림 누르기: 열린 창이 있으면 앞으로 가져와 진행 화면으로 보내고, 없으면 진행 화면을 새 창으로 연다', async () => {
  const open = makeSw(2);
  await handleNotificationClick(open.sw);
  assert.deepEqual(open.focused, [0]);
  assert.deepEqual(open.messages, [{ to: 0, type: 'open-session' }]);
  assert.deepEqual(open.opened, []);

  const none = makeSw(0);
  await handleNotificationClick(none.sw);
  assert.deepEqual(none.opened, [SESSION_URL]);
  assert.equal(SESSION_URL, '/#/session');
});
