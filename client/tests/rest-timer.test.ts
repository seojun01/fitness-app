import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRestTimer, type TimerStorage } from '../src/rest-timer.ts';

function env(start = 1_000_000) {
  let now = start;
  const data = new Map<string, string>();
  const storage: TimerStorage = { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v) };
  return { clock: () => now, advance: (ms: number) => (now += ms), storage, data };
}

test('start 후 남은 시간은 시각 기준으로 줄어든다', () => {
  const e = env();
  const t = createRestTimer({ now: e.clock, storage: e.storage });
  assert.equal(t.view().state, 'idle');
  t.start(60);
  assert.equal(t.view().state, 'running');
  assert.equal(t.view().remainingMs, 60_000);
  e.advance(12_500);
  assert.equal(t.view().remainingMs, 47_500);
  assert.equal(t.view().totalMs, 60_000);
});

test('일시정지·재개·정지', () => {
  const e = env();
  const t = createRestTimer({ now: e.clock, storage: e.storage });
  t.start(60);
  e.advance(10_000);
  t.pause();
  e.advance(30_000);
  assert.equal(t.view().state, 'paused');
  assert.equal(t.view().remainingMs, 50_000);
  t.resume();
  e.advance(5_000);
  assert.equal(t.view().remainingMs, 45_000);
  t.stop();
  assert.equal(t.view().state, 'idle');
});

test('진행 중 ±15초는 남은 시간을 옮기고, 0 이하가 되면 done', () => {
  const e = env();
  let doneCalls = 0;
  const t = createRestTimer({ now: e.clock, storage: e.storage, onDone: () => doneCalls++ });
  t.start(30);
  t.adjust(15);
  assert.equal(t.view().remainingMs, 45_000);
  t.adjust(-15);
  t.adjust(-15);
  assert.equal(t.view().remainingMs, 15_000);
  t.adjust(-15);
  assert.equal(t.tick().state, 'done');
  assert.equal(doneCalls, 1);
});

test('멈춘 상태의 ±15초는 기본 시간(base)을 15~600 안에서 바꾸고 알려 준다', () => {
  const e = env();
  const bases: number[] = [];
  const t = createRestTimer({ now: e.clock, storage: e.storage, onBaseChange: (s) => bases.push(s) });
  t.setBase(60);
  t.adjust(15);
  t.adjust(15);
  assert.equal(t.view().baseSeconds, 90);
  t.setBase(15);
  t.adjust(-15);
  assert.equal(t.view().baseSeconds, 15, '15초 아래로 내려가지 않는다');
  t.setBase(600);
  t.adjust(15);
  assert.equal(t.view().baseSeconds, 600, '10분을 넘지 않는다');
  assert.deepEqual(bases, [75, 90]);
});

test('0초가 되면 tick 이 done 으로 바꾸고 onDone 은 한 번만 부른다', () => {
  const e = env();
  let calls = 0;
  const t = createRestTimer({ now: e.clock, storage: e.storage, onDone: () => calls++ });
  t.start(15);
  e.advance(15_001);
  assert.equal(t.tick().state, 'done');
  t.tick();
  t.tick();
  assert.equal(calls, 1);
  assert.equal(t.view().remainingMs, 0);
});

test('저장소에서 복원하면(새로고침) 남은 시간이 이어진다 (오차 1초 이내)', () => {
  const e = env();
  const a = createRestTimer({ now: e.clock, storage: e.storage });
  a.start(60);
  e.advance(20_300);
  const b = createRestTimer({ now: e.clock, storage: e.storage });
  assert.equal(b.view().state, 'running');
  assert.ok(Math.abs(b.view().remainingMs - 39_700) < 1000);
  b.pause();
  const c = createRestTimer({ now: e.clock, storage: e.storage });
  assert.equal(c.view().state, 'paused');
});

test('깨진 저장값은 idle 로 시작한다', () => {
  const e = env();
  e.data.set('fitness.restTimer', '{깨짐');
  assert.equal(createRestTimer({ now: e.clock, storage: e.storage }).view().state, 'idle');
  e.data.set('fitness.restTimer', JSON.stringify({ state: 'running', endsAt: 'x' }));
  assert.equal(createRestTimer({ now: e.clock, storage: e.storage }).view().state, 'idle');
});

test('저장소가 예외를 던져도 동작한다', () => {
  const e = env();
  const broken: TimerStorage = { get: () => { throw new Error('막힘'); }, set: () => { throw new Error('막힘'); } };
  const t = createRestTimer({ now: e.clock, storage: broken });
  t.start(30);
  assert.equal(t.view().state, 'running');
});
