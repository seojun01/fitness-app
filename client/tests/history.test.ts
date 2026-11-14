import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { createCtx, type Ctx } from '../src/context.ts';
import { createRoutine, deleteRoutine } from '../src/routines.ts';
import { finishSession, startSession, updateSet } from '../src/sessions.ts';
import { commit, openFitnessDb, type StoredSession } from '../src/store/db.ts';
import { ensureSeed } from '../src/store/records.ts';
import { deleteSession, exerciseHistory, listHistory, removeCompletedSet, restoreSession, updateCompletedSet } from '../src/history.ts';

const [A, B] = [SEED_EXERCISES[0]!, SEED_EXERCISES[1]!];
let n = 0;
async function setup(): Promise<Ctx> {
  const db = await openFitnessDb(`fitness-history-${++n}-${Math.random()}`);
  await ensureSeed(db);
  return createCtx(db, { deviceId: 'dev-1' });
}
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

/** 직접 만든 완료 세션 */
function completed(i: number, endedAt: string, sets: [number, number][], over: Partial<StoredSession> = {}, exercise = A): StoredSession {
  return {
    id: uuid(i), status: 'completed', routineId: null, routineName: `루틴${i}`, startedAt: new Date(Date.parse(endedAt) - 3_600_000).toISOString(), endedAt, startedBy: 'dev-1',
    entries: [{ entryId: uuid(1000 + i), exerciseId: exercise.id, exerciseName: exercise.name, sets: sets.map(([w, r], k) => ({ setId: uuid(2000 + i * 10 + k), weightKg: w, reps: r, done: true })) }],
    deleted: false, version: `001762950896789-${String(i).padStart(6, '0')}-dev-1`, updatedBy: 'dev-1', dirty: 0, ...over,
  };
}

test('완료 세션은 최신순이고 날짜·루틴명·총 볼륨·세트 수·시간 요약이 붙는다', async () => {
  const ctx = await setup();
  await commit(ctx.db, {
    sessions: [
      completed(1, '2026-11-01T11:00:00.000Z', [[60, 10]]),
      completed(2, '2026-11-10T11:00:00.000Z', [[65, 8], [65, 8]]),
      completed(3, '2026-11-05T11:00:00.000Z', [[50, 10]], { status: 'active', endedAt: null }), // 진행 중은 제외
    ],
  });
  const rows = await listHistory(ctx.db);
  assert.deepEqual(rows.map((r) => r.id), [uuid(2), uuid(1)]);
  assert.deepEqual(
    { name: rows[0]!.routineName, vol: rows[0]!.totalVolumeKg, sets: rows[0]!.completedSets, dur: rows[0]!.durationSec, endedAt: rows[0]!.endedAt },
    { name: '루틴2', vol: 1040, sets: 2, dur: 3600, endedAt: '2026-11-10T11:00:00.000Z' },
  );
});

test('삭제된 세션은 목록에서 빠지고, 되돌리면 돌아온다', async () => {
  const ctx = await setup();
  await commit(ctx.db, { sessions: [completed(1, '2026-11-01T11:00:00.000Z', [[60, 10]]), completed(2, '2026-11-02T11:00:00.000Z', [[60, 10]])] });
  await deleteSession(ctx, uuid(1));
  assert.deepEqual((await listHistory(ctx.db)).map((r) => r.id), [uuid(2)]);
  await restoreSession(ctx, uuid(1));
  assert.equal((await listHistory(ctx.db)).length, 2);
});

test('세트를 수정하면 목록 요약(총 볼륨)에 반영되고 새 version 이 발급된다', async () => {
  const ctx = await setup();
  const s = completed(1, '2026-11-01T11:00:00.000Z', [[60, 10], [60, 8]]);
  await commit(ctx.db, { sessions: [s] });
  const e = s.entries[0]!;
  const edited = await updateCompletedSet(ctx, s.id, e.entryId, e.sets[0]!.setId, { weightKg: 70, reps: 10 });
  assert.ok(edited.version > s.version);
  assert.equal(edited.dirty, 1);
  assert.equal((await listHistory(ctx.db))[0]!.totalVolumeKg, 700 + 480);
  const after = await removeCompletedSet(ctx, s.id, e.entryId, e.sets[1]!.setId);
  assert.equal(after.entries[0]!.sets.length, 1);
  assert.equal((await listHistory(ctx.db))[0]!.totalVolumeKg, 700);
});

test('완료된 세트의 수정은 검증을 지킨다 (reps 1~999 정수, weightKg 0~1000)', async () => {
  const ctx = await setup();
  const s = completed(1, '2026-11-01T11:00:00.000Z', [[60, 10]]);
  await commit(ctx.db, { sessions: [s] });
  const e = s.entries[0]!;
  const id = e.sets[0]!.setId;
  await assert.rejects(updateCompletedSet(ctx, s.id, e.entryId, id, { reps: 0 }));
  await assert.rejects(updateCompletedSet(ctx, s.id, e.entryId, id, { weightKg: -1 }));
  await assert.rejects(updateCompletedSet(ctx, s.id, e.entryId, id, { weightKg: null })); // 완료된 세트를 비울 수 없다
  assert.equal((await listHistory(ctx.db))[0]!.totalVolumeKg, 600);
});

test('종목 이력: 그 종목의 완료 세트를 날짜순(최신 먼저)으로, 다른 종목은 섞이지 않는다', async () => {
  const ctx = await setup();
  await commit(ctx.db, {
    sessions: [
      completed(1, '2026-11-01T11:00:00.000Z', [[60, 10]]),
      completed(2, '2026-11-08T11:00:00.000Z', [[62.5, 8], [62.5, 6]]),
      completed(3, '2026-11-04T11:00:00.000Z', [[30, 12]], {}, B),
      completed(4, '2026-11-09T11:00:00.000Z', [[1, 1]], { deleted: true }),
    ],
  });
  const h = await exerciseHistory(ctx.db, A.id);
  assert.deepEqual(h.map((x) => x.sessionId), [uuid(2), uuid(1)]);
  assert.deepEqual(h[0]!.sets, [{ weightKg: 62.5, reps: 8 }, { weightKg: 62.5, reps: 6 }]);
  assert.deepEqual((await exerciseHistory(ctx.db, B.id)).map((x) => x.sessionId), [uuid(3)]);
  assert.deepEqual(await exerciseHistory(ctx.db, SEED_EXERCISES[5]!.id), []);
});

test('삭제된 루틴으로 만든 세션은 당시 루틴명으로 표시된다 (FR-013)', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '사라질 루틴', [{ exerciseId: A.id, targetSets: 1 }]);
  let s = await startSession(ctx, r);
  s = await updateSet(ctx, s.id, s.entries[0]!.entryId, s.entries[0]!.sets[0]!.setId, { weightKg: 40, reps: 10, done: true });
  await finishSession(ctx, s.id, { ifEmpty: 'save' });
  await deleteRoutine(ctx, r.id);
  const rows = await listHistory(ctx.db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.routineName, '사라질 루틴');
});

test('SC-005: 세션 500개 기준 목록 조회가 1초 이내', async () => {
  const ctx = await setup();
  const sessions = Array.from({ length: 500 }, (_, i) => completed(i + 1, new Date(Date.UTC(2025, 0, 1) + i * 86_400_000).toISOString(), [[60, 10], [60, 8], [60, 6]]));
  await commit(ctx.db, { sessions });
  const t0 = performance.now();
  const rows = await listHistory(ctx.db);
  const ms = performance.now() - t0;
  assert.equal(rows.length, 500);
  assert.ok(rows[0]!.endedAt! > rows[499]!.endedAt!);
  assert.ok(ms < 1000, `목록 조회에 ${Math.round(ms)}ms 걸렸어요`);
});
