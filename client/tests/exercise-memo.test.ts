import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { SEED_VERSION } from '../../shared/model.ts';
import { createCtx } from '../src/context.ts';
import { setExerciseMemo } from '../src/exercises.ts';
import { ValidationError } from '../src/errors.ts';
import { openFitnessDb } from '../src/store/db.ts';
import { ensureSeed, getExercise } from '../src/store/records.ts';

async function setup() {
  const db = await openFitnessDb(`fitness-memo-${Math.random()}`);
  await ensureSeed(db);
  return createCtx(db, { deviceId: 'dev-1' });
}

test('메모는 줄바꿈과 공백을 그대로 저장하고 새 version·dirty 가 붙는다 (기본 종목도 동기화 대상이 된다)', async () => {
  const ctx = await setup();
  const seed = SEED_EXERCISES[0]!;
  const saved = await setExerciseMemo(ctx, seed.id, '의자 높이 4\n  그립 넓게 ');
  assert.equal(saved.memo, '의자 높이 4\n  그립 넓게 ');
  assert.equal(saved.dirty, 1);
  assert.notEqual(saved.version, SEED_VERSION);
  assert.equal((await getExercise(ctx.db, seed.id))!.memo, '의자 높이 4\n  그립 넓게 ');
});

test('500자까지 저장되고 501자는 거부된다', async () => {
  const ctx = await setup();
  const id = SEED_EXERCISES[1]!.id;
  assert.ok(await setExerciseMemo(ctx, id, '가'.repeat(500)));
  await assert.rejects(setExerciseMemo(ctx, id, '가'.repeat(501)), (e) => e instanceof ValidationError && e.field === 'memo');
  assert.equal([...(await getExercise(ctx.db, id))!.memo!].length, 500);
});
