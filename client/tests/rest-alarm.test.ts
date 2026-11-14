import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRestAlarm } from '../src/rest-alarm.ts';
import { createRestTimer, type TimerStorage } from '../src/rest-timer.ts';

function setup(opts: { paired?: boolean; online?: boolean } = {}) {
  let now = Date.parse('2026-11-15T10:00:00.000Z');
  const data = new Map<string, string>();
  const storage: TimerStorage = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
  const calls: { method: string; body: unknown; csrf: string | undefined }[] = [];
  const st = { online: opts.online ?? true };
  const fetchFake: typeof fetch = async (input, init) => {
    if (!st.online) throw new TypeError('offline');
    assert.equal(String(input), '/api/rest-alarm');
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined, csrf: headers['X-Fitness-Client'] });
    return new Response('{}', { status: 200 });
  };
  const alarm = createRestAlarm({ isPaired: async () => opts.paired ?? true, fetch: fetchFake });
  let pending: Promise<void> = Promise.resolve();
  const timer = createRestTimer({ now: () => now, storage, baseSeconds: 90, onChange: (v) => void (pending = alarm.sync(v)) });
  return { timer, calls, st, advance: (ms: number) => (now += ms), flush: () => pending, iso: (ms: number) => new Date(ms).toISOString(), now: () => now };
}

test('시작 → 끝나는 시각을 PUT, 일시정지 → DELETE, 재개 → 새 시각 PUT, 정지 → DELETE', async () => {
  const e = setup();
  const t0 = e.now();
  e.timer.start();
  await e.flush();
  assert.deepEqual(e.calls, [{ method: 'PUT', body: { endsAt: e.iso(t0 + 90_000) }, csrf: '1' }]);
  e.advance(30_000);
  e.timer.pause();
  await e.flush();
  assert.equal(e.calls.at(-1)!.method, 'DELETE');
  e.advance(60_000);
  e.timer.resume();
  await e.flush();
  assert.deepEqual(e.calls.at(-1)!.body, { endsAt: e.iso(e.now() + 60_000) });
  e.timer.stop();
  await e.flush();
  assert.deepEqual(e.calls.map((c) => c.method), ['PUT', 'DELETE', 'PUT', 'DELETE']);
});

test('진행 중 ±15초는 바뀐 시각으로 다시 PUT, 멈춘 상태의 기본 시간 조절은 요청하지 않는다', async () => {
  const e = setup();
  e.timer.adjust(15); // idle: 기본 시간만 바뀐다
  await e.flush();
  assert.equal(e.calls.length, 0);
  const t0 = e.now();
  e.timer.start();
  e.timer.adjust(15);
  await e.flush();
  assert.deepEqual(e.calls.map((c) => c.body), [{ endsAt: e.iso(t0 + 105_000) }, { endsAt: e.iso(t0 + 120_000) }]);
});

test('휴식이 끝나면(done) 예약을 지운다', async () => {
  const e = setup();
  e.timer.start(15);
  e.advance(16_000);
  e.timer.tick();
  await e.flush();
  assert.deepEqual(e.calls.map((c) => c.method), ['PUT', 'DELETE']);
});

test('홈서버에 등록하지 않은 기기는 아무것도 보내지 않는다', async () => {
  const e = setup({ paired: false });
  e.timer.start();
  e.timer.pause();
  await e.flush();
  assert.equal(e.calls.length, 0);
});

test('네트워크 오류는 조용히 넘기고, 다음 변경 때 다시 보낸다', async () => {
  const e = setup({ online: false });
  e.timer.start();
  await assert.doesNotReject(e.flush());
  e.st.online = true;
  e.timer.adjust(15);
  await e.flush();
  assert.equal(e.calls.length, 1);
  assert.equal(e.calls[0]!.method, 'PUT');
});
