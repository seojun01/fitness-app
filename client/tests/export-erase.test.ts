import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { validateRecord } from '../../shared/model.ts';
import { createCtx } from '../src/context.ts';
import { createRoutine } from '../src/routines.ts';
import { finishSession, startSession, updateSet } from '../src/sessions.ts';
import { setWeightUnit } from '../src/settings.ts';
import { openFitnessDb } from '../src/store/db.ts';
import { ensureSeed, listAllExercises, listAllRoutines, listAllSessions, getSettingsRecord } from '../src/store/records.ts';
import { eraseAllData, exportAllData } from '../src/export.ts';
import { createExercise, deleteExercise } from '../src/exercises.ts';
import { deleteRoutine } from '../src/routines.ts';

let n = 0;
async function setup() {
  const db = await openFitnessDb(`fitness-export-${++n}-${Math.random()}`);
  await ensureSeed(db);
  const ctx = await createCtx(db, { deviceId: 'dev-1' });
  const mine = await createExercise(ctx, { name: '내 종목', bodyPart: 'arms' });
  const r = await createRoutine(ctx, '내 루틴', [{ exerciseId: mine.id, targetSets: 2 }]);
  let s = await startSession(ctx, r);
  s = await updateSet(ctx, s.id, s.entries[0]!.entryId, s.entries[0]!.sets[0]!.setId, { weightKg: 30, reps: 12, done: true });
  await finishSession(ctx, s.id, { ifEmpty: 'save' });
  await setWeightUnit(ctx, 'lb');
  return { ctx, mine, r, sessionId: s.id };
}

test('내보내기: fitness-export 형식, 툼스톤·version·updatedBy·dirty 를 빼고 무게는 weightKg 로', async () => {
  const { ctx, r } = await setup();
  const gone = await createRoutine(ctx, '지운 루틴', []);
  await deleteRoutine(ctx, gone.id);
  const out = await exportAllData(ctx.db, '2026-11-14T12:00:00.000Z');
  assert.equal(out.format, 'fitness-export');
  assert.equal(out.version, 1);
  assert.equal(out.exportedAt, '2026-11-14T12:00:00.000Z');
  assert.deepEqual(out.routines.map((x) => x.id), [r.id]);
  assert.equal(out.sessions.length, 1);
  assert.equal(out.sessions[0]!.entries[0]!.sets[0]!.weightKg, 30);
  assert.deepEqual(out.settings, { weightUnit: 'lb' });
  const text = JSON.stringify(out);
  for (const forbidden of ['"version":"0', '"updatedBy"', '"dirty"', '"deleted"']) assert.ok(!text.includes(forbidden), forbidden);
  assert.equal(out.exercises.length, SEED_EXERCISES.length + 1, '기본 종목과 직접 만든 종목이 모두 들어간다');
});

test('삭제한 종목(시드 포함)은 내보내기에서 빠진다', async () => {
  const { ctx, mine } = await setup();
  await deleteExercise(ctx, mine.id);
  await deleteExercise(ctx, SEED_EXERCISES[0]!.id);
  const out = await exportAllData(ctx.db);
  assert.equal(out.exercises.length, SEED_EXERCISES.length - 1);
});

test('전체 삭제: 루틴·세션·직접 만든 종목·설정이 id·version·deleted·updatedBy 만 남은 툼스톤이 되고 dirty 로 표시된다', async () => {
  const { ctx } = await setup();
  await eraseAllData(ctx);
  for (const store of [await listAllRoutines(ctx.db), await listAllSessions(ctx.db), (await listAllExercises(ctx.db)).filter((e) => e.custom !== false)]) {
    assert.ok(store.length > 0);
    for (const rec of store) {
      assert.deepEqual(Object.keys(rec).sort(), ['deleted', 'dirty', 'id', 'updatedBy', 'version']);
      assert.equal(rec.deleted, true);
      assert.equal(rec.dirty, 1);
    }
  }
  const settings = (await getSettingsRecord(ctx.db))!;
  assert.deepEqual(Object.keys(settings).sort(), ['deleted', 'dirty', 'id', 'updatedBy', 'version']);
  const out = await exportAllData(ctx.db);
  assert.deepEqual([out.exercises.length, out.routines.length, out.sessions.length, out.settings], [SEED_EXERCISES.length, 0, 0, null], '기본 종목만 남는다');
});

test('전체 삭제 후의 툼스톤은 서버 검증을 통과한다 (push 가능)', async () => {
  const { ctx } = await setup();
  await eraseAllData(ctx);
  for (const r of await listAllRoutines(ctx.db)) {
    const { dirty: _d, ...plain } = r;
    assert.deepEqual(validateRecord('routine', plain), []);
  }
  for (const s of await listAllSessions(ctx.db)) {
    const { dirty: _d, ...plain } = s;
    assert.deepEqual(validateRecord('session', plain), []);
  }
});

test('전체 삭제 후에도 기본 종목은 남고, 사용자가 고치거나 지운 기본 종목은 기본값으로 되돌아간다', async () => {
  const { ctx } = await setup();
  const edited = SEED_EXERCISES[0]!;
  const removed = SEED_EXERCISES[1]!;
  const { renameExercise } = await import('../src/exercises.ts');
  await renameExercise(ctx, edited.id, '내가 바꾼 이름');
  await deleteExercise(ctx, removed.id);
  await eraseAllData(ctx);
  const all = await listAllExercises(ctx.db);
  const byId = new Map(all.map((e) => [e.id, e]));
  assert.equal(byId.get(edited.id)!.name, edited.name);
  assert.equal(byId.get(edited.id)!.deleted, false);
  assert.equal(byId.get(removed.id)!.deleted, false);
  assert.ok(byId.get(edited.id)!.dirty === 1 && byId.get(removed.id)!.dirty === 1, '되돌린 기본값은 다른 기기에도 퍼져야 하므로 올린다');
  assert.equal(all.filter((e) => !e.deleted).length, SEED_EXERCISES.length);
  // 건드리지 않은 기본 종목은 그대로(시드 버전, dirty 아님)
  const untouched = byId.get(SEED_EXERCISES[5]!.id)!;
  assert.equal(untouched.dirty, 0);
  assert.equal(untouched.version, '000000000000000-000000-seed');
});
