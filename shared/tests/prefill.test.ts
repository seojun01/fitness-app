import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session, SetEntry } from '../model.ts';
import { prefillSets, previousSets } from '../prefill.ts';

const EX = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';
const set = (weightKg: number | null, reps: number | null, done = true): SetEntry => ({ setId: crypto.randomUUID(), weightKg, reps, done });
let n = 0;
const session = (endedAt: string, entries: { ex: string; sets: SetEntry[] }[], over: Partial<Session> = {}): Session => ({
  id: crypto.randomUUID(), status: 'completed', routineId: null, routineName: null, startedAt: endedAt, endedAt, startedBy: 'dev',
  entries: entries.map((e) => ({ entryId: crypto.randomUUID(), exerciseId: e.ex, exerciseName: 'x', sets: e.sets })), deleted: false, version: `v${++n}`, updatedBy: 'dev', ...over,
});

test('가장 최근 완료 세션의 완료된 세트를 같은 번호에 채운다', () => {
  const old = session('2026-11-01T10:00:00.000Z', [{ ex: EX, sets: [set(50, 10)] }]);
  const recent = session('2026-11-10T10:00:00.000Z', [{ ex: EX, sets: [set(60, 10), set(62.5, 8), set(65, 6, false)] }]);
  assert.deepEqual(previousSets(EX, [old, recent]), [{ weightKg: 60, reps: 10 }, { weightKg: 62.5, reps: 8 }]);
  assert.deepEqual(prefillSets(EX, [old, recent], 2), [{ weightKg: 60, reps: 10 }, { weightKg: 62.5, reps: 8 }]);
});

test('직전보다 세트가 많으면 마지막 세트 값을 복사한다', () => {
  const s = session('2026-11-10T10:00:00.000Z', [{ ex: EX, sets: [set(60, 10), set(70, 5)] }]);
  assert.deepEqual(prefillSets(EX, [s], 4), [{ weightKg: 60, reps: 10 }, { weightKg: 70, reps: 5 }, { weightKg: 70, reps: 5 }, { weightKg: 70, reps: 5 }]);
});

test('직전보다 세트가 적으면 앞쪽만 쓴다', () => {
  const s = session('2026-11-10T10:00:00.000Z', [{ ex: EX, sets: [set(60, 10), set(70, 5), set(80, 3)] }]);
  assert.deepEqual(prefillSets(EX, [s], 1), [{ weightKg: 60, reps: 10 }]);
});

test('이력이 없으면 빈 값(null)이다', () => {
  assert.deepEqual(previousSets(EX, []), []);
  assert.deepEqual(prefillSets(EX, [], 2), [{ weightKg: null, reps: null }, { weightKg: null, reps: null }]);
  assert.deepEqual(prefillSets(EX, [session('2026-11-10T10:00:00.000Z', [{ ex: OTHER, sets: [set(10, 10)] }])], 1), [{ weightKg: null, reps: null }]);
});

test('진행 중·삭제된 세션과 완료 세트가 없는 세션은 무시한다', () => {
  const good = session('2026-11-02T10:00:00.000Z', [{ ex: EX, sets: [set(40, 12)] }]);
  const active = session('2026-11-12T10:00:00.000Z', [{ ex: EX, sets: [set(99, 1)] }], { status: 'active', endedAt: null });
  const deleted = session('2026-11-11T10:00:00.000Z', [{ ex: EX, sets: [set(98, 1)] }], { deleted: true });
  const noneDone = session('2026-11-09T10:00:00.000Z', [{ ex: EX, sets: [set(97, 1, false)] }]);
  assert.deepEqual(previousSets(EX, [good, active, deleted, noneDone]), [{ weightKg: 40, reps: 12 }]);
});

test('채워진 세트는 아직 완료가 아니다 (값만 돌려주므로 호출 쪽이 done=false 로 만든다)', () => {
  const s = session('2026-11-10T10:00:00.000Z', [{ ex: EX, sets: [set(60, 10)] }]);
  const out = prefillSets(EX, [s], 1)[0]!;
  assert.deepEqual(Object.keys(out).sort(), ['reps', 'weightKg']);
});
