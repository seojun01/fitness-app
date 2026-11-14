import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { SEED_VERSION } from '../../shared/model.ts';
import { merge } from '../../shared/merge.ts';
import { createCtx } from '../src/context.ts';
import { commit, listDirty, openFitnessDb, runTx, req, type StoredExercise } from '../src/store/db.ts';
import { getMeta } from '../src/store/meta.ts';
import { ensureSeed, getExercise, listAllExercises, saveRecords } from '../src/store/records.ts';

let n = 0;
const fresh = () => openFitnessDb(`fitness-test-${++n}-${Math.random()}`);
const ex = (over: Partial<StoredExercise> = {}): StoredExercise => ({
  id: crypto.randomUUID(), name: '벤치', bodyPart: 'chest', custom: true, bodyweight: false, deleted: false, version: '001762950896789-000000-dev', updatedBy: 'dev', dirty: 1, ...over,
});

test('레코드를 저장하고 읽고 삭제 표시를 한다', async () => {
  const db = await fresh();
  const e = ex();
  await commit(db, { exercises: [e] });
  assert.deepEqual(await getExercise(db, e.id), e);
  await commit(db, { exercises: [{ ...e, deleted: true }] });
  assert.equal((await getExercise(db, e.id))!.deleted, true);
});

test('트랜잭션 도중 실패하면 전부 롤백된다', async () => {
  const db = await fresh();
  const a = ex();
  await assert.rejects(
    runTx(db, ['exercises'], 'readwrite', async (tx) => {
      tx.objectStore('exercises').put(a);
      await req(tx.objectStore('exercises').get(a.id));
      throw new Error('중간 실패');
    }),
  );
  assert.equal(await getExercise(db, a.id), undefined);
});

test('저장소를 다시 열어도 데이터가 남는다 (업그레이드 경로가 데이터를 지우지 않는다)', async () => {
  const name = `fitness-reopen-${Math.random()}`;
  const db1 = await openFitnessDb(name);
  const e = ex();
  await commit(db1, { exercises: [e], meta: { cursor: 7 } });
  db1.close();
  const db2 = await openFitnessDb(name);
  assert.deepEqual(await getExercise(db2, e.id), e);
  assert.equal(await getMeta(db2, 'cursor'), 7);
  assert.deepEqual([...db2.objectStoreNames].sort(), ['exercises', 'guideNotes', 'meta', 'routines', 'sessions', 'settings']);
});

test('dirty 인 레코드만 listDirty 에 나온다', async () => {
  const db = await fresh();
  await commit(db, { exercises: [ex({ dirty: 1 }), ex({ dirty: 0 })] });
  assert.equal((await listDirty(db, 'exercises')).length, 1);
});

test('saveRecords 는 새 version 과 updatedBy 를 붙이고 dirty 로 저장하며 HLC 상태도 남긴다', async () => {
  const db = await fresh();
  const ctx = await createCtx(db, { deviceId: 'dev-1', hlcNow: () => 1_700_000_000_000 });
  const e = ex({ version: '000000000000001-000000-old', updatedBy: 'other', dirty: 0 });
  const [saved] = (await saveRecords(ctx, { exercises: [e] })).exercises;
  assert.equal(saved!.dirty, 1);
  assert.equal(saved!.updatedBy, 'dev-1');
  assert.match(saved!.version, /^\d{15}-\d{6}-dev-1$/);
  assert.ok(saved!.version > e.version);
  assert.deepEqual(await getMeta(db, 'hlc'), ctx.hlc.state());
});

test('첫 실행 시드: 한 번만 들어가고 dirty 가 아니며 시드 버전이다', async () => {
  const db = await fresh();
  await ensureSeed(db);
  await ensureSeed(db);
  const all = await listAllExercises(db);
  assert.equal(all.length, SEED_EXERCISES.length);
  assert.ok(all.every((e) => e.dirty === 0 && e.version === SEED_VERSION));
  assert.equal((await listDirty(db, 'exercises')).length, 0, '시드는 서버로 올리지 않는다');
});

test('시드는 이미 있는 레코드(삭제 표시)를 덮어쓰지 않고, merge 에서도 진다', async () => {
  const db = await fresh();
  const seed = SEED_EXERCISES[0]!;
  const tomb: StoredExercise = { ...seed, deleted: true, version: '001762950896789-000000-dev', updatedBy: 'dev', dirty: 0 };
  await commit(db, { exercises: [tomb] });
  await ensureSeed(db);
  assert.equal((await getExercise(db, seed.id))!.deleted, true);
  // 다른 기기의 시드가 pull 로 들어와도 삭제를 되살리지 못한다
  assert.equal(merge(tomb, seed), tomb);
});
