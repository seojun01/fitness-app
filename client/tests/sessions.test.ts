import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { createCtx } from '../src/context.ts';
import { ValidationError } from '../src/errors.ts';
import { createRoutine } from '../src/routines.ts';
import { openFitnessDb } from '../src/store/db.ts';
import { ensureSeed, getSession } from '../src/store/records.ts';
import {
  ActiveSessionError, addEntry, addSet, discardSession, finishSession, getActiveSession, removeEntry, removeSet, startSession, updateSet,
} from '../src/sessions.ts';
import { deleteExercise } from '../src/exercises.ts';
import { deleteRoutine } from '../src/routines.ts';
import { completedSets } from '../../shared/volume.ts';

let n = 0;
async function setup(now = () => new Date('2026-11-14T10:00:00.000Z')) {
  const db = await openFitnessDb(`fitness-sessions-${++n}-${Math.random()}`);
  await ensureSeed(db);
  return createCtx(db, { deviceId: 'dev-1', now });
}
const [A, B] = [SEED_EXERCISES[0]!, SEED_EXERCISES[1]!];

test('루틴으로 시작: 항목마다 exerciseName 과 routineName 을 복사하고 목표 세트 수만큼 빈 세트를 만든다', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '푸시', [{ exerciseId: A.id, targetSets: 3 }, { exerciseId: B.id, targetSets: 2 }]);
  const s = await startSession(ctx, r);
  assert.equal(s.status, 'active');
  assert.equal(s.routineId, r.id);
  assert.equal(s.routineName, '푸시');
  assert.equal(s.startedBy, 'dev-1');
  assert.equal(s.endedAt, null);
  assert.deepEqual(s.entries.map((e) => [e.exerciseName, e.sets.length]), [[A.name, 3], [B.name, 2]]);
  assert.ok(s.entries.every((e) => e.sets.every((x) => x.done === false && x.weightKg === null && x.reps === null)));
  assert.equal(s.dirty, 1);
});

test('삭제된 종목 항목은 세션 시작 시 건너뛴다', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '루틴', [{ exerciseId: A.id, targetSets: 1 }, { exerciseId: B.id, targetSets: 1 }]);
  await deleteExercise(ctx, A.id);
  const s = await startSession(ctx, r);
  assert.deepEqual(s.entries.map((e) => e.exerciseId), [B.id]);
});

test('빈 세션 시작 후 종목을 즉석에서 추가한다', async () => {
  const ctx = await setup();
  const s = await startSession(ctx, null);
  assert.equal(s.routineId, null);
  assert.equal(s.routineName, null);
  assert.deepEqual(s.entries, []);
  const s2 = await addEntry(ctx, s.id, A.id);
  assert.equal(s2.entries.length, 1);
  assert.equal(s2.entries[0]!.exerciseName, A.name);
  assert.equal(s2.entries[0]!.sets.length, 1, '이력이 없으면 빈 세트 1개');
});

test('진행 중 세션은 기기당 최대 1개', async () => {
  const ctx = await setup();
  const s = await startSession(ctx, null);
  await assert.rejects(startSession(ctx, null), ActiveSessionError);
  assert.equal((await getActiveSession(ctx))!.id, s.id);
  await discardSession(ctx, s.id);
  assert.equal(await getActiveSession(ctx), undefined);
  assert.ok(await startSession(ctx, null));
});

test('세트 추가·수정·삭제·완료 토글, 즉시 저장', async () => {
  const ctx = await setup();
  let s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 1 }]));
  const entry = s.entries[0]!;
  s = await addSet(ctx, s.id, entry.entryId);
  assert.equal(s.entries[0]!.sets.length, 2);
  const [s1, s2] = s.entries[0]!.sets;
  s = await updateSet(ctx, s.id, entry.entryId, s1!.setId, { weightKg: 60, reps: 10 });
  s = await updateSet(ctx, s.id, entry.entryId, s1!.setId, { done: true });
  assert.deepEqual(s.entries[0]!.sets[0], { setId: s1!.setId, weightKg: 60, reps: 10, done: true });
  assert.deepEqual((await getSession(ctx.db, s.id))!.entries[0]!.sets[0], s.entries[0]!.sets[0], '저장소에도 반영');
  s = await updateSet(ctx, s.id, entry.entryId, s1!.setId, { done: false });
  assert.equal(s.entries[0]!.sets[0]!.done, false);
  s = await removeSet(ctx, s.id, entry.entryId, s2!.setId);
  assert.equal(s.entries[0]!.sets.length, 1);
  s = await removeEntry(ctx, s.id, entry.entryId);
  assert.equal(s.entries.length, 0);
});

test('새 세트는 직전 세트의 값을 복사하되 완료가 아니다', async () => {
  const ctx = await setup();
  let s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 1 }]));
  const e = s.entries[0]!;
  s = await updateSet(ctx, s.id, e.entryId, e.sets[0]!.setId, { weightKg: 42.5, reps: 8 });
  s = await addSet(ctx, s.id, e.entryId);
  assert.deepEqual([s.entries[0]!.sets[1]!.weightKg, s.entries[0]!.sets[1]!.reps, s.entries[0]!.sets[1]!.done], [42.5, 8, false]);
});

test('입력 검증: weightKg 0 이상 1000 이하, reps 1 이상 999 이하 정수, 완료는 값이 있어야 한다', async () => {
  const ctx = await setup();
  const s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 1 }]));
  const e = s.entries[0]!;
  const id = e.sets[0]!.setId;
  const bad = (patch: Parameters<typeof updateSet>[4], field: string) =>
    assert.rejects(updateSet(ctx, s.id, e.entryId, id, patch), (err) => err instanceof ValidationError && err.field.endsWith(field), JSON.stringify(patch));
  await bad({ weightKg: -1 }, 'weightKg');
  await bad({ weightKg: 1000.01 }, 'weightKg');
  await bad({ reps: 0 }, 'reps');
  await bad({ reps: 1.5 }, 'reps');
  await bad({ reps: 1000 }, 'reps');
  await bad({ done: true }, 'weightKg'); // 값이 비어 있는 채로 완료할 수 없다
  const ok = await updateSet(ctx, s.id, e.entryId, id, { weightKg: 0, reps: 999, done: true });
  assert.deepEqual([ok.entries[0]!.sets[0]!.weightKg, ok.entries[0]!.sets[0]!.reps], [0, 999], '맨몸 0kg 와 999회는 허용');
  assert.equal((await getSession(ctx.db, s.id))!.entries[0]!.sets[0]!.reps, 999, '실패한 수정은 저장소를 바꾸지 않는다');
});

test('종료: endedAt·status=completed, 완료 세트가 있으면 바로 저장', async () => {
  let t = new Date('2026-11-14T10:00:00.000Z');
  const ctx = await setup(() => t);
  let s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 1 }]));
  const e = s.entries[0]!;
  s = await updateSet(ctx, s.id, e.entryId, e.sets[0]!.setId, { weightKg: 60, reps: 10, done: true });
  t = new Date('2026-11-14T10:50:00.000Z');
  const out = await finishSession(ctx, s.id, { ifEmpty: 'ask' });
  assert.equal(out.outcome, 'completed');
  assert.equal(out.session.status, 'completed');
  assert.equal(out.session.endedAt, '2026-11-14T10:50:00.000Z');
  assert.equal(completedSets(out.session), 1);
  assert.equal(await getActiveSession(ctx), undefined);
});

test('완료 세트 0개 종료: ask 는 확인이 필요하다고 돌려주고, save 는 저장, discard 는 툼스톤', async () => {
  const ctx = await setup();
  const s = await startSession(ctx, null);
  const ask = await finishSession(ctx, s.id, { ifEmpty: 'ask' });
  assert.equal(ask.outcome, 'empty');
  assert.equal((await getSession(ctx.db, s.id))!.status, 'active', 'ask 는 아무것도 바꾸지 않는다');
  const saved = await finishSession(ctx, s.id, { ifEmpty: 'save' });
  assert.equal(saved.outcome, 'completed');

  const s2 = await startSession(ctx, null);
  const gone = await finishSession(ctx, s2.id, { ifEmpty: 'discard' });
  assert.equal(gone.outcome, 'discarded');
  assert.equal((await getSession(ctx.db, s2.id))!.deleted, true);
});

test('루틴을 삭제해도 완료한 세션은 당시 routineName 을 유지한다 (FR-013)', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '삭제될 루틴', [{ exerciseId: A.id, targetSets: 1 }]);
  let s = await startSession(ctx, r);
  const e = s.entries[0]!;
  s = await updateSet(ctx, s.id, e.entryId, e.sets[0]!.setId, { weightKg: 10, reps: 10, done: true });
  await finishSession(ctx, s.id, { ifEmpty: 'save' });
  await deleteRoutine(ctx, r.id);
  const stored = (await getSession(ctx.db, s.id))!;
  assert.equal(stored.routineName, '삭제될 루틴');
  assert.equal(stored.deleted, false);
});

test('두 번째 세션 시작 시 직전 세션 값이 채워진다 (FR-006)', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 2 }]);
  let s = await startSession(ctx, r);
  const e = s.entries[0]!;
  s = await updateSet(ctx, s.id, e.entryId, e.sets[0]!.setId, { weightKg: 60, reps: 10, done: true });
  s = await updateSet(ctx, s.id, e.entryId, e.sets[1]!.setId, { weightKg: 65, reps: 8, done: true });
  await finishSession(ctx, s.id, { ifEmpty: 'save' });
  const next = await startSession(ctx, r);
  assert.deepEqual(next.entries[0]!.sets.map((x) => [x.weightKg, x.reps, x.done]), [[60, 10, false], [65, 8, false]]);
  const adhoc = await addEntry(ctx, next.id, A.id);
  assert.deepEqual(adhoc.entries[1]!.sets.map((x) => [x.weightKg, x.reps]), [[60, 10], [65, 8]], '즉석 추가도 직전 값을 채운다');
});

test('모든 세트 완료: 값이 있는 세트만 완료하고 빈 세트 수를 알려 준다', async () => {
  const { completeAllSets } = await import('../src/sessions.ts');
  const ctx = await setup();
  let s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 3 }]));
  const e = s.entries[0]!;
  s = await updateSet(ctx, s.id, e.entryId, e.sets[0]!.setId, { weightKg: 50, reps: 10 });
  s = await updateSet(ctx, s.id, e.entryId, e.sets[1]!.setId, { weightKg: 50, reps: null });
  const out = await completeAllSets(ctx, s.id, e.entryId);
  assert.deepEqual([out.completed, out.skippedEmpty], [1, 2]);
  assert.deepEqual(out.session.entries[0]!.sets.map((x) => x.done), [true, false, false]);
});

test('마지막 세트 삭제: 세트가 없으면 아무것도 하지 않는다', async () => {
  const { removeLastSet } = await import('../src/sessions.ts');
  const ctx = await setup();
  let s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 2 }]));
  const e = s.entries[0]!;
  const keep = e.sets[0]!.setId;
  s = await removeLastSet(ctx, s.id, e.entryId);
  assert.deepEqual(s.entries[0]!.sets.map((x) => x.setId), [keep]);
  s = await removeLastSet(ctx, s.id, e.entryId);
  assert.equal(s.entries[0]!.sets.length, 0);
  s = await removeLastSet(ctx, s.id, e.entryId);
  assert.equal(s.entries[0]!.sets.length, 0);
});

test('종목 추가는 맨 뒤에 붙는다', async () => {
  const ctx = await setup();
  let s = await startSession(ctx, await createRoutine(ctx, 'r', [{ exerciseId: A.id, targetSets: 1 }]));
  s = await addEntry(ctx, s.id, B.id);
  assert.deepEqual(s.entries.map((e) => e.exerciseId), [A.id, B.id]);
});
