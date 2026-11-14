import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { createCtx } from '../src/context.ts';
import { createExercise, deleteExercise, renameExercise } from '../src/exercises.ts';
import { listGuideEntries, saveGuideNote } from '../src/guides.ts';
import { openFitnessDb } from '../src/store/db.ts';
import { ensureSeed } from '../src/store/records.ts';

async function setup() {
  const db = await openFitnessDb(`fitness-guide-list-${Math.random()}`);
  await ensureSeed(db);
  return createCtx(db, { deviceId: 'dev-1' });
}

test('부위 필터와 이름 검색(공백·대소문자 무시), 삭제된 종목 제외', async () => {
  const ctx = await setup();
  const legs = await listGuideEntries(ctx.db, { bodyPart: 'legs' });
  assert.equal(legs.length, SEED_EXERCISES.filter((e) => e.bodyPart === 'legs').length);
  assert.ok(legs.every((e) => e.exercise.bodyPart === 'legs' && e.hasGuide && e.primaryMuscles.length > 0));
  assert.deepEqual((await listGuideEntries(ctx.db, { query: '레그컬' })).map((e) => e.exercise.name), ['레그 컬']);
  const target = SEED_EXERCISES.find((e) => e.name === '딥스')!;
  await deleteExercise(ctx, target.id);
  assert.equal((await listGuideEntries(ctx.db, { query: '딥스' })).length, 0);
});

test('이름을 바꾼 기본 종목도 가이드가 남고, 직접 만든 종목은 노트 유무를 따른다', async () => {
  const ctx = await setup();
  const seed = SEED_EXERCISES.find((e) => e.name === '해머 컬')!;
  await renameExercise(ctx, seed.id, '뉴트럴 컬');
  const renamed = (await listGuideEntries(ctx.db, { query: '뉴트럴' }))[0]!;
  assert.equal(renamed.hasGuide, true);
  assert.deepEqual(renamed.primaryMuscles, ['biceps', 'forearms']);
  const mine = await createExercise(ctx, { name: 'Zercher 스쿼트', bodyPart: 'legs' });
  assert.equal((await listGuideEntries(ctx.db, { query: 'zercher' }))[0]!.hasGuide, false);
  await saveGuideNote(ctx, mine.id, { cues: ['팔꿈치에 바를 건다'], mistakes: [], primaryMuscles: ['quads'], secondaryMuscles: [] });
  const after = (await listGuideEntries(ctx.db, { query: 'ZERCHER' }))[0]!;
  assert.equal(after.hasGuide, true);
  assert.deepEqual(after.primaryMuscles, ['quads']);
});
