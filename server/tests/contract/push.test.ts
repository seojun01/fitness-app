import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { revokeDevice } from '../../src/auth.ts';
import { startFakePush, type FakePush } from '../helpers/fake-push-service.ts';
import { startTestServer, type TestServer } from '../helpers/server.ts';

let push: FakePush;
let now = new Date(); // 페어링 코드 만료가 실제 시계로 계산되므로 지금에서 시작한다
let s: TestServer;
before(async () => {
  push = await startFakePush();
  s = await startTestServer({ now: () => now, push: { allowHosts: [push.host] } });
});
after(async () => {
  await s.close();
  await push.close();
});

const subscribe = async (cookie: string) => {
  const sub = push.newSubscription();
  const res = await s.api('/api/devices/me/push', { method: 'PUT', cookie, body: { subscription: { endpoint: sub.endpoint, keys: sub.keys } } });
  assert.equal(res.status, 200);
  return sub;
};
const sentTo = (subId: string) => push.received.filter((r) => r.subscription === subId);

test('공개키는 인증이 필요하고, 다시 물어도 같은 키다', async () => {
  assert.equal((await s.api('/api/push/key')).status, 401);
  const { cookie } = await s.pair();
  const a = (await (await s.api('/api/push/key', { cookie })).json()) as { publicKey: string };
  const b = (await (await s.api('/api/push/key', { cookie })).json()) as { publicKey: string };
  assert.equal(Buffer.from(a.publicKey, 'base64url').length, 65);
  assert.equal(a.publicKey, b.publicKey);
});

test('구독 등록: 허용되지 않은 주소·잘못된 키는 400, 등록하면 /api/devices/me 에 보인다', async () => {
  const { cookie } = await s.pair();
  const bad = push.newSubscription();
  for (const subscription of [
    { endpoint: 'https://evil.example.com/push/1', keys: bad.keys },
    { endpoint: 'http://web.push.apple.com/x', keys: bad.keys },
    { endpoint: bad.endpoint, keys: { p256dh: 'abc', auth: bad.keys.auth } },
    { endpoint: bad.endpoint, keys: { p256dh: bad.keys.p256dh, auth: 'zz' } },
  ]) {
    const res = await s.api('/api/devices/me/push', { method: 'PUT', cookie, body: { subscription } });
    assert.equal(res.status, 400, JSON.stringify(subscription).slice(0, 60));
  }
  await subscribe(cookie);
  const me = (await (await s.api('/api/devices/me', { cookie })).json()) as { push: { subscribed: boolean; enabled: boolean } };
  assert.deepEqual(me.push, { subscribed: true, enabled: true });
  assert.equal((await s.api('/api/devices/me/push', { method: 'PUT', cookie, body: { enabled: false } })).status, 200);
  const me2 = (await (await s.api('/api/devices/me', { cookie })).json()) as { push: { enabled: boolean } };
  assert.equal(me2.push.enabled, false);
  assert.equal((await s.api('/api/devices/me/push', { method: 'DELETE', cookie })).status, 200);
  const me3 = (await (await s.api('/api/devices/me', { cookie })).json()) as { push: { subscribed: boolean } };
  assert.equal(me3.push.subscribed, false);
});

test('테스트 푸시: 구독이 없으면 409, 있으면 암호화된 {v:1,test:true} 만 간다', async () => {
  const { cookie } = await s.pair();
  assert.equal((await s.api('/api/push/test', { method: 'POST', cookie })).status, 409);
  const sub = await subscribe(cookie);
  assert.equal((await s.api('/api/push/test', { method: 'POST', cookie })).status, 200);
  assert.deepEqual(sentTo(sub.id).map((r) => r.payload), [{ v: 1, test: true }]);
  assert.match(String(sentTo(sub.id)[0]!.headers.authorization), /^vapid t=.+, k=.+$/);
});

test('rest-alarm: 예약 → 만기에 "휴식 끝" 푸시 1회, 예약은 지워진다', async () => {
  const { cookie } = await s.pair();
  const sub = await subscribe(cookie);
  const endsAt = new Date(now.getTime() + 60_000).toISOString();
  assert.equal((await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: { endsAt } })).status, 200);
  assert.equal(await s.scheduler.tick(), 0, '아직 이르다');
  now = new Date(now.getTime() + 60_500);
  assert.equal(await s.scheduler.tick(), 1);
  assert.deepEqual(sentTo(sub.id).map((r) => r.payload), [{ v: 1, kind: 'rest-end' }]);
  assert.equal(await s.scheduler.tick(), 0, '한 번만 보낸다');
});

test('rest-alarm: 새 예약이 이전 예약을 바꾸고, 취소하면 보내지 않는다', async () => {
  const { cookie } = await s.pair();
  const sub = await subscribe(cookie);
  await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: { endsAt: new Date(now.getTime() + 30_000).toISOString() } });
  await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: { endsAt: new Date(now.getTime() + 90_000).toISOString() } });
  now = new Date(now.getTime() + 31_000);
  await s.scheduler.tick();
  assert.equal(sentTo(sub.id).length, 0, '바뀐 시각 전에는 보내지 않는다');
  assert.equal((await s.api('/api/rest-alarm', { method: 'DELETE', cookie })).status, 200);
  now = new Date(now.getTime() + 120_000);
  await s.scheduler.tick();
  assert.equal(sentTo(sub.id).length, 0, '취소한 예약은 보내지 않는다');
});

test('rest-alarm: 시각 검증 (형식, 너무 먼 미래, 이미 지난 시각)', async () => {
  const { cookie } = await s.pair();
  for (const endsAt of ['내일', new Date(now.getTime() + 31 * 60_000).toISOString(), new Date(now.getTime() - 60_000).toISOString()]) {
    const res = await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: { endsAt } });
    assert.equal(res.status, 400, endsAt);
  }
  assert.equal((await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: {} })).status, 400);
});

test('꺼진 구독·구독 없는 기기에는 보내지 않고, 2분 넘게 지난 예약도 보내지 않는다', async () => {
  const off = await s.pair();
  const offSub = await subscribe(off.cookie);
  await s.api('/api/devices/me/push', { method: 'PUT', cookie: off.cookie, body: { enabled: false } });
  const none = await s.pair();
  const late = await s.pair();
  const lateSub = await subscribe(late.cookie);
  const endsAt = new Date(now.getTime() + 10_000).toISOString();
  for (const c of [off.cookie, none.cookie, late.cookie]) await s.api('/api/rest-alarm', { method: 'PUT', cookie: c, body: { endsAt } });
  now = new Date(now.getTime() + 10_000 + 3 * 60_000); // 서버가 멈춰 있다가 3분 늦게 돌았다
  await s.scheduler.tick();
  assert.equal(sentTo(offSub.id).length, 0);
  assert.equal(sentTo(lateSub.id).length, 0, '너무 늦은 알림은 보내지 않는다');
});

test('푸시 서비스가 410 이면 구독을 지운다', async () => {
  const { cookie } = await s.pair();
  await subscribe(cookie);
  push.setStatus(410);
  try {
    await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: { endsAt: new Date(now.getTime() + 5_000).toISOString() } });
    now = new Date(now.getTime() + 6_000);
    await s.scheduler.tick();
  } finally {
    push.setStatus(201);
  }
  const me = (await (await s.api('/api/devices/me', { cookie })).json()) as { push: { subscribed: boolean } };
  assert.equal(me.push.subscribed, false);
});

test('기기를 해제하면 구독과 예약이 지워진다', async () => {
  const { deviceId, cookie } = await s.pair();
  const sub = await subscribe(cookie);
  await s.api('/api/rest-alarm', { method: 'PUT', cookie, body: { endsAt: new Date(now.getTime() + 5_000).toISOString() } });
  revokeDevice(s.db, deviceId, now);
  now = new Date(now.getTime() + 6_000);
  await s.scheduler.tick();
  assert.equal(sentTo(sub.id).length, 0);
  assert.equal((s.db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE device_id = ?').get(deviceId) as { n: number }).n, 0);
});
