import { test, after, before } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, mkSession, readSse, type TestServer } from '../helpers/server.ts';
import { revokeDevice } from '../../src/auth.ts';

let s: TestServer;
before(async () => {
  s = await startTestServer({ events: { checkMs: 40, pingMs: 10_000 } });
});
after(async () => {
  await s.close();
});

test('SSE 는 인증이 필요하다', async () => {
  assert.equal((await s.api('/api/events')).status, 401);
});

test('연결 직후 현재 cursor 이벤트가 온다', async () => {
  const { cookie } = await s.pair();
  const res = await s.api('/api/events', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
  const sse = await readSse(res);
  const first = await sse.next();
  assert.ok(first && first !== 'timeout');
  assert.equal(first.event, 'cursor');
  assert.equal(typeof JSON.parse(first.data).cursor, 'number');
  sse.cancel();
});

test('계약 11: 다른 클라이언트가 push 하면 1초 안에 cursor 이벤트가 온다', async () => {
  const a = await s.pair('listener');
  const b = await s.pair('writer');
  const sse = await readSse(await s.api('/api/events', { cookie: a.cookie }));
  const first = await sse.next();
  assert.ok(first && first !== 'timeout');
  const start = JSON.parse(first.data).cursor as number;
  const t0 = Date.now();
  const pushed = await s.api('/api/changes', { cookie: b.cookie, body: { changes: [{ type: 'session', record: mkSession() }] } });
  assert.equal(pushed.status, 200);
  const ev = await sse.next(1000);
  assert.ok(ev && ev !== 'timeout', '1초 안에 이벤트가 와야 한다');
  assert.equal(JSON.parse(ev.data).cursor, start + 1);
  assert.ok(Date.now() - t0 < 1000);
  sse.cancel();
});

test('반영되지 않은(ignored) push 는 이벤트를 만들지 않는다', async () => {
  const a = await s.pair();
  const rec = mkSession();
  await s.api('/api/changes', { cookie: a.cookie, body: { changes: [{ type: 'session', record: rec }] } });
  const sse = await readSse(await s.api('/api/events', { cookie: a.cookie }));
  await sse.next();
  await s.api('/api/changes', { cookie: a.cookie, body: { changes: [{ type: 'session', record: rec }] } });
  assert.equal(await sse.next(300), 'timeout');
  sse.cancel();
});

test('계약 11: 기기를 해제하면 스트림이 닫히고 이후 재연결은 401', async () => {
  const { deviceId, cookie } = await s.pair('to-revoke');
  const sse = await readSse(await s.api('/api/events', { cookie }));
  await sse.next();
  revokeDevice(s.db, deviceId, new Date());
  assert.equal(await sse.next(1500), null, '스트림이 닫혀야 한다');
  assert.equal((await s.api('/api/events', { cookie })).status, 401);
});
