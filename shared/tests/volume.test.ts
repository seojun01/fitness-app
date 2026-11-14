import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session, SetEntry } from '../model.ts';
import { completedSets, durationSec, entryVolume, sessionVolume, setVolume, summarize } from '../volume.ts';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const set = (weightKg: number | null, reps: number | null, done = true): SetEntry => ({ setId: crypto.randomUUID(), weightKg, reps, done });
const session = (entries: SetEntry[][], over: Partial<Session> = {}): Session => ({
  id: U(1), status: 'completed', routineId: null, routineName: null, startedAt: '2026-11-14T10:00:00.000Z', endedAt: '2026-11-14T10:45:30.000Z', startedBy: 'dev',
  entries: entries.map((sets, i) => ({ entryId: U(10 + i), exerciseId: U(20 + i), exerciseName: `종목${i}`, sets })), deleted: false, version: 'v', updatedBy: 'dev', ...over,
});

test('setVolume = weightKg × reps, 완료된 세트만', () => {
  assert.equal(setVolume(set(60, 10)), 600);
  assert.equal(setVolume(set(60, 10, false)), 0);
  assert.equal(setVolume(set(2.5, 8)), 20);
  assert.equal(setVolume(set(null, null, false)), 0);
});

test('맨몸(무게 0)은 볼륨 0이지만 완료 세트 수에는 포함된다', () => {
  const s = session([[set(0, 15), set(0, 12)]]);
  assert.equal(sessionVolume(s), 0);
  assert.equal(completedSets(s), 2);
});

test('entryVolume 과 sessionVolume 은 done 세트의 합', () => {
  const s = session([[set(60, 10), set(60, 8), set(60, 6, false)], [set(20, 12), set(null, null, false)]]);
  assert.equal(entryVolume(s.entries[0]!), 1080);
  assert.equal(entryVolume(s.entries[1]!), 240);
  assert.equal(sessionVolume(s), 1320);
  assert.equal(completedSets(s), 3);
});

test('부동소수점 오차 없이 합산한다', () => {
  const s = session([[set(0.1, 3), set(0.2, 3), set(0.7, 1)]]);
  assert.equal(sessionVolume(s), 1.6);
});

test('durationSec = endedAt − startedAt, 진행 중에는 현재 시각 기준', () => {
  assert.equal(durationSec(session([])), 45 * 60 + 30);
  const active = session([], { status: 'active', endedAt: null });
  assert.equal(durationSec(active, Date.parse('2026-11-14T10:10:00.000Z')), 600);
  assert.equal(durationSec(active, Date.parse('2026-11-14T09:00:00.000Z')), 0, '음수는 0');
});

test('summarize', () => {
  const s = session([[set(100, 5), set(100, 5)]]);
  assert.deepEqual(summarize(s), { durationSec: 2730, completedSets: 2, totalVolumeKg: 1000 });
});
