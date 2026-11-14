import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { createCtx } from '../src/context.ts';
import { createRoutine } from '../src/routines.ts';
import { openFitnessDb } from '../src/store/db.ts';
import { ensureSeed, getSession } from '../src/store/records.ts';
import {
  STALE_AFTER_MS, addSet, getActiveSession, listOtherDeviceActive, ReadOnlySessionError, resolveStale, restoreState, startSession, updateSet,
} from '../src/sessions.ts';

const A = SEED_EXERCISES[0]!;
let n = 0;
async function open() {
  const db = await openFitnessDb(`fitness-restore-${++n}-${Math.random()}`);
  await ensureSeed(db);
  return db;
}

test('앱을 다시 열어도(새 컨텍스트) 진행 중 세션이 복원된다', async () => {
  const db = await open();
  const ctx1 = await createCtx(db, { deviceId: 'dev-1' });
  const r = await createRoutine(ctx1, 'r', [{ exerciseId: A.id, targetSets: 2 }]);
  let s = await startSession(ctx1, r);
  s = await updateSet(ctx1, s.id, s.entries[0]!.entryId, s.entries[0]!.sets[0]!.setId, { weightKg: 60, reps: 10 });
  const ctx2 = await createCtx(db, { deviceId: 'dev-1' }); // 재시작
  const restored = await restoreState(ctx2);
  assert.equal(restored.active!.id, s.id);
  assert.equal(restored.active!.entries[0]!.sets[0]!.weightKg, 60);
  assert.equal(restored.stale, false);
});

test('마지막 활동 후 12시간이 지나면 stale 이고, 이어하기·종료·폐기를 고를 수 있다', async () => {
  const db = await open();
  const t0 = new Date('2026-11-14T10:00:00.000Z');
  const ctx = await createCtx(db, { deviceId: 'dev-1', now: () => t0 });
  const s = await startSession(ctx, null);
  assert.equal(STALE_AFTER_MS, 12 * 3600_000);

  const later = await createCtx(db, { deviceId: 'dev-1', now: () => new Date(t0.getTime() + STALE_AFTER_MS + 60_000), hlcNow: () => t0.getTime() + STALE_AFTER_MS + 60_000 });
  assert.equal((await restoreState(later)).stale, true);

  await resolveStale(later, s.id, 'continue'); // 이어하기: 활동으로 간주해 stale 이 풀린다
  assert.equal((await restoreState(later)).stale, false);
  assert.equal((await getSession(db, s.id))!.status, 'active');

  const s2 = await getSession(db, s.id);
  assert.ok(s2);
  await resolveStale(later, s.id, 'discard');
  assert.equal((await getSession(db, s.id))!.deleted, true);
  assert.equal(await getActiveSession(later), undefined);

  const s3 = await startSession(later, null);
  await resolveStale(later, s3.id, 'finish');
  assert.equal((await getSession(db, s3.id))!.status, 'completed');
});

test('12시간이 지나기 전에는 stale 이 아니다', async () => {
  const db = await open();
  const t0 = new Date('2026-11-14T10:00:00.000Z');
  const ctx = await createCtx(db, { deviceId: 'dev-1', now: () => t0 });
  await startSession(ctx, null);
  const soon = await createCtx(db, { deviceId: 'dev-1', now: () => new Date(t0.getTime() + STALE_AFTER_MS - 60_000) });
  assert.equal((await restoreState(soon)).stale, false);
});

test('다른 기기가 시작한 진행 중 세션은 읽기 전용이고 "다른 기기에서 진행 중"으로만 보인다', async () => {
  const db = await open();
  const phone = await createCtx(db, { deviceId: 'phone' });
  const pc = await createCtx(db, { deviceId: 'pc' });
  const s = await startSession(phone, null);
  assert.equal((await restoreState(pc)).active, undefined);
  assert.deepEqual((await listOtherDeviceActive(pc)).map((x) => x.id), [s.id]);
  await assert.rejects(addSet(pc, s.id, 'x'), ReadOnlySessionError);
  await assert.rejects(updateSet(pc, s.id, 'x', 'y', { done: true }), ReadOnlySessionError);
});

test('두 기기가 각각 진행 중 세션을 만들어도 각 기기는 자기 세션만 이어하기로 본다 (기기당 1개)', async () => {
  const db = await open();
  const phone = await createCtx(db, { deviceId: 'phone' });
  const pc = await createCtx(db, { deviceId: 'pc' });
  const a = await startSession(phone, null);
  const b = await startSession(pc, null); // 같은 저장소를 쓰지만 기기가 달라 허용 (동기화 후 상황을 흉내)
  assert.equal((await restoreState(phone)).active!.id, a.id);
  assert.equal((await restoreState(pc)).active!.id, b.id);
  assert.deepEqual((await listOtherDeviceActive(phone)).map((x) => x.id), [b.id]);
  assert.deepEqual((await listOtherDeviceActive(pc)).map((x) => x.id), [a.id]);
});
