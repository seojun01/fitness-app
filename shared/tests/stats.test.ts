import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session, SetEntry } from '../model.ts';
import { compare, entryTotals, estimate1rm, exerciseRecords, lastPerformed, previousTotals, relativeDay, routineBodyParts } from '../stats.ts';

const EX = '00000000-0000-4000-8000-0000000000aa';
const OTHER = '00000000-0000-4000-8000-0000000000bb';
const set = (w: number | null, r: number | null, done = true): SetEntry => ({ setId: crypto.randomUUID(), weightKg: w, reps: r, done });
let n = 0;
function session(endedAt: string | null, entries: { ex: string; sets: SetEntry[] }[], over: Partial<Session> = {}): Session {
  return {
    id: `s${++n}`, status: endedAt ? 'completed' : 'active', routineId: null, routineName: null, startedAt: endedAt ?? '2026-11-14T10:00:00.000Z', endedAt, startedBy: 'd',
    entries: entries.map((e) => ({ entryId: crypto.randomUUID(), exerciseId: e.ex, exerciseName: 'x', sets: e.sets })), deleted: false, version: 'v', updatedBy: 'd', ...over,
  };
}

test('previousTotals: 현재 세션·진행 중·삭제 세션을 빼고 가장 최근 세션의 같은 종목 완료 세트 합계 (여러 항목 합산)', () => {
  const old = session('2026-11-01T10:00:00.000Z', [{ ex: EX, sets: [set(50, 10)] }]);
  const recent = session('2026-11-10T10:00:00.000Z', [{ ex: EX, sets: [set(60, 10), set(60, 8), set(60, 5, false)] }, { ex: EX, sets: [set(40, 10)] }]);
  const deleted = session('2026-11-12T10:00:00.000Z', [{ ex: EX, sets: [set(99, 1)] }], { deleted: true });
  const current = session('2026-11-13T10:00:00.000Z', [{ ex: EX, sets: [set(70, 1)] }]);
  const active = session(null, [{ ex: EX, sets: [set(80, 1)] }]);
  const p = previousTotals(EX, [old, recent, deleted, current, active], current.id)!;
  assert.equal(p.sessionId, recent.id);
  assert.equal(p.volumeKg, 600 + 480 + 400);
  assert.equal(p.reps, 28);
  assert.equal(p.allZero, false);
  assert.equal(previousTotals(OTHER, [old, recent], 'none'), null);
});

test('entryTotals: 완료 세트만', () => {
  const s = session(null, [{ ex: EX, sets: [set(60, 10), set(60, 8, false), set(null, null, false)] }]);
  assert.deepEqual(entryTotals(s.entries[0]!), { volumeKg: 600, reps: 10, allZero: false });
  assert.deepEqual(entryTotals(session(null, [{ ex: EX, sets: [set(0, 12)] }]).entries[0]!), { volumeKg: 0, reps: 12, allZero: true });
});

test('compare: 볼륨 비교 (▼ 남음, ▲ 넘음, 같음, 첫 기록)', () => {
  const prev = { sessionId: 'p', endedAt: 'x', volumeKg: 1080, reps: 18, allZero: false };
  assert.deepEqual(compare({ volumeKg: 600, reps: 10, allZero: false }, prev, false), { metric: 'volume', current: 600, previous: 1080, diff: 480, direction: 'down' });
  assert.deepEqual(compare({ volumeKg: 1100, reps: 20, allZero: false }, prev, false), { metric: 'volume', current: 1100, previous: 1080, diff: 20, direction: 'up' });
  assert.equal(compare({ volumeKg: 1080, reps: 18, allZero: false }, prev, false).direction, 'same');
  assert.deepEqual(compare({ volumeKg: 0, reps: 0, allZero: false }, null, false), { metric: 'volume', current: 0, previous: null, diff: 0, direction: 'first' });
});

test('compare: 맨몸 종목이거나 이번·지난번 무게가 모두 0이면 횟수로 비교한다', () => {
  const prev = { sessionId: 'p', endedAt: 'x', volumeKg: 0, reps: 26, allZero: true };
  assert.deepEqual(compare({ volumeKg: 0, reps: 0, allZero: true }, prev, false), { metric: 'reps', current: 0, previous: 26, diff: 26, direction: 'down' });
  const weighted = { sessionId: 'p', endedAt: 'x', volumeKg: 500, reps: 20, allZero: false };
  assert.equal(compare({ volumeKg: 0, reps: 22, allZero: true }, weighted, true).metric, 'reps', '맨몸 종목은 항상 횟수');
  assert.equal(compare({ volumeKg: 0, reps: 22, allZero: true }, weighted, false).metric, 'volume', '지난번에 무게가 있었으면 볼륨');
});

test('estimate1rm: 엡리 공식, 1회는 무게 그대로, 무게 0 은 0', () => {
  assert.equal(estimate1rm(100, 1), 100);
  assert.equal(estimate1rm(100, 10), 100 * (1 + 10 / 30));
  assert.equal(estimate1rm(0, 15), 0);
});

test('exerciseRecords: 1RM 최고(소수 첫째 자리), 최고 무게, 누적 볼륨, 최다·누적 횟수, 최근 2세션', () => {
  const a = session('2026-11-01T10:00:00.000Z', [{ ex: EX, sets: [set(100, 5), set(90, 8)] }]);
  const b = session('2026-11-05T10:00:00.000Z', [{ ex: EX, sets: [set(105, 3)] }, { ex: OTHER, sets: [set(300, 1)] }]);
  const c = session('2026-11-09T10:00:00.000Z', [{ ex: EX, sets: [set(80, 12), set(80, 1, false)] }]);
  const r = exerciseRecords(EX, [a, b, c]);
  assert.equal(r.best1rmKg, 116.7); // 100 × (1+5/30) = 116.67
  assert.equal(r.maxWeightKg, 105);
  assert.equal(r.totalVolumeKg, 500 + 720 + 315 + 960);
  assert.equal(r.maxReps, 12);
  assert.equal(r.totalReps, 5 + 8 + 3 + 12);
  assert.deepEqual(r.recent.map((x) => x.endedAt), [c.endedAt, b.endedAt]);
  assert.deepEqual(r.recent[0]!.sets, [{ weightKg: 80, reps: 12 }]);
  const empty = exerciseRecords('none', [a]);
  assert.deepEqual([empty.best1rmKg, empty.maxWeightKg, empty.totalVolumeKg, empty.recent.length], [0, 0, 0, 0]);
});

test('relativeDay: 기기 시간대 기준 오늘·어제·N일 전·30일 이상은 날짜', () => {
  const now = new Date(2026, 10, 14, 9, 0); // 기기 현지 시각
  const at = (d: number, h = 23) => new Date(2026, 10, d, h, 0).toISOString();
  assert.equal(relativeDay(at(14, 7), now), '오늘');
  assert.equal(relativeDay(at(13, 23), now), '어제', '날짜 경계: 어젯밤 11시는 어제');
  assert.equal(relativeDay(at(11), now), '3일 전');
  assert.equal(relativeDay(new Date(2026, 9, 15, 10).toISOString(), now), '30일 전');
  assert.equal(relativeDay(new Date(2026, 9, 14, 10).toISOString(), now), '2026.10.14');
});

test('lastPerformed: 그 루틴으로 완료한 세션의 최신 endedAt', () => {
  const R = 'routine-1';
  const a = session('2026-11-01T10:00:00.000Z', [], { routineId: R });
  const b = session('2026-11-09T10:00:00.000Z', [], { routineId: R });
  const del = session('2026-11-12T10:00:00.000Z', [], { routineId: R, deleted: true });
  const other = session('2026-11-13T10:00:00.000Z', [], { routineId: 'x' });
  assert.equal(lastPerformed(R, [a, b, del, other]), b.endedAt);
  assert.equal(lastPerformed('none', [a]), null);
});

test('routineBodyParts: 루틴 순서대로, 중복 없이, 삭제·없는 종목 제외', () => {
  const ex = (id: string, bodyPart: string, deleted = false) => ({ id, bodyPart, deleted }) as never;
  const exercises = new Map([['a', ex('a', 'back')], ['b', ex('b', 'arms')], ['c', ex('c', 'back')], ['d', ex('d', 'legs', true)]]);
  const routine = { items: ['a', 'b', 'c', 'd', 'zz'].map((exerciseId) => ({ exerciseId, targetSets: 3 })) };
  assert.deepEqual(routineBodyParts(routine, exercises), ['back', 'arms']);
});
