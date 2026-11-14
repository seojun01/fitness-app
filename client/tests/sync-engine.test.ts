import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { SEED_VERSION } from '../../shared/model.ts';
import { createCtx, type Ctx } from '../src/context.ts';
import { commit, listDirty, openFitnessDb, type StoredExercise, type StoredSession } from '../src/store/db.ts';
import { getMeta } from '../src/store/meta.ts';
import { createSyncEngine } from '../src/sync/engine.ts';
import { ensureSeed, getExercise, getRoutine, getSession, listAllExercises, listAllSessions } from '../src/store/records.ts';
import { createRoutine } from '../src/routines.ts';
import { startSession } from '../src/sessions.ts';
import { createFakeServer, type FakeServer } from './helpers/fake-server.ts';
import { liveRecords } from '../../server/src/sync.ts';

let n = 0;
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;

async function device(server: FakeServer, deviceId: string, opts: { paired?: boolean } = {}) {
  const db = await openFitnessDb(`sync-test-${++n}-${Math.random()}`);
  await ensureSeed(db);
  const ctx: Ctx = await createCtx(db, { deviceId });
  if (opts.paired !== false) await commit(db, { meta: { paired: true } }, { silent: true });
  const engine = createSyncEngine(ctx, { fetch: server.fetch, debounceMs: 0 });
  return { db, ctx, engine };
}

const session = (i: number, over: Partial<StoredSession> = {}): StoredSession => ({
  id: uuid(i), status: 'completed', routineId: null, routineName: null, startedAt: '2026-11-14T10:00:00.000Z', endedAt: '2026-11-14T11:00:00.000Z', startedBy: 'x',
  entries: [{ entryId: uuid(10_000 + i), exerciseId: SEED_EXERCISES[0]!.id, exerciseName: 'x', sets: [{ setId: uuid(20_000 + i), weightKg: 50, reps: 5, done: true }] }],
  deleted: false, version: `001762950896789-${String(i).padStart(6, '0')}-x`, updatedBy: 'x', dirty: 0, ...over,
});

test('dirty 레코드만 push 하고, 성공하면 dirty 가 풀린다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  const r = await createRoutine(a.ctx, '루틴', []);
  await commit(a.db, { sessions: [session(1, { dirty: 0 })] }, { silent: true }); // dirty 가 아니므로 올라가지 않는다
  const status = await a.engine.syncNow();
  assert.equal(status.state, 'synced');
  assert.equal(status.pending, 0);
  assert.deepEqual(liveRecords(server.db, 'routine').map((x) => x.id), [r.id]);
  assert.equal(liveRecords(server.db, 'session').length, 0);
});

test('dirty 가 아닌 로컬 레코드는 서버로 올리지 않는다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  await commit(a.db, { sessions: [session(1, { dirty: 0 })] }, { silent: true });
  await a.engine.syncNow();
  assert.equal(liveRecords(server.db, 'session').length, 0);
});

test('push 는 500개씩 나눠 보낸다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  await commit(a.db, { sessions: Array.from({ length: 1100 }, (_, i) => session(i + 1, { dirty: 1 })) }, { silent: true });
  await a.engine.syncNow();
  const pushes = server.calls.filter((c) => c.method === 'POST');
  assert.deepEqual(pushes.map((p) => p.body.changes.length), [500, 500, 100]);
  assert.equal(liveRecords(server.db, 'session').length, 1100);
  assert.equal((await listDirty(a.db, 'sessions')).length, 0);
});

test('다른 기기의 변경을 pull 해 병합하고 cursor 를 저장한다 (같은 트랜잭션)', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  const b = await device(server, 'dev-b');
  const r = await createRoutine(a.ctx, '공유 루틴', []);
  await a.engine.syncNow();
  const status = await b.engine.syncNow();
  assert.equal(status.state, 'synced');
  assert.equal((await getRoutine(b.db, r.id))!.name, '공유 루틴');
  assert.equal((await getRoutine(b.db, r.id))!.dirty, 0);
  assert.ok(((await getMeta<number>(b.db, 'cursor')) ?? 0) >= 1);
});

test('pull 은 페이지로 나뉘어도 빠짐없이 받는다', async () => {
  const server = createFakeServer();
  server.hooks.maxLimit = 7;
  const a = await device(server, 'dev-a');
  const b = await device(server, 'dev-b');
  await commit(a.db, { sessions: Array.from({ length: 30 }, (_, i) => session(i + 1, { dirty: 1 })) }, { silent: true });
  await a.engine.syncNow();
  await b.engine.syncNow();
  assert.equal((await listAllSessions(b.db)).length, 30);
});

test('LWW: 더 오래된 원격 레코드는 로컬의 새 변경을 덮어쓰지 않는다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  const b = await device(server, 'dev-b');
  const older = session(1, { routineName: '옛날', version: '001762950896789-000001-x', dirty: 1 });
  const newer = session(1, { routineName: '최근', version: '001762950899999-000001-x', dirty: 1 });
  await commit(a.db, { sessions: [older] }, { silent: true });
  await a.engine.syncNow();
  await commit(b.db, { sessions: [newer] }, { silent: true });
  await b.engine.syncNow();
  await a.engine.syncNow();
  assert.equal((await getSession(a.db, uuid(1)))!.routineName, '최근');
  assert.equal((await getSession(b.db, uuid(1)))!.routineName, '최근');
});

test('응답을 못 받은 push 를 다시 보내도 중복되지 않는다 (멱등)', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  await createRoutine(a.ctx, '루틴', []);
  server.hooks.loseNextPushResponse = true;
  const first = await a.engine.syncNow();
  assert.equal(first.state, 'offline');
  assert.equal(first.pending, 1, '응답을 못 받았으니 아직 대기 중');
  const second = await a.engine.syncNow();
  assert.equal(second.state, 'synced');
  assert.equal(liveRecords(server.db, 'routine').length, 1);
  assert.equal(server.calls.filter((c) => c.method === 'POST').length, 2);
});

test('서버 cursor 가 저장된 값보다 작으면(서버 복원) 모든 로컬 레코드를 다시 올린다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  const r = await createRoutine(a.ctx, '살아남아야 하는 루틴', []);
  await commit(a.db, { sessions: [session(1, { dirty: 1 })] }, { silent: true });
  await a.engine.syncNow();
  assert.equal(liveRecords(server.db, 'routine').length, 1);

  // 서버가 비어 있는 백업으로 복원됨
  const restored = createFakeServer();
  const engine = createSyncEngine(a.ctx, { fetch: restored.fetch, debounceMs: 0 });
  const status = await engine.syncNow();
  assert.equal(status.state, 'synced');
  assert.deepEqual(liveRecords(restored.db, 'routine').map((x) => x.id), [r.id]);
  assert.equal(liveRecords(restored.db, 'session').length, 1);
  assert.equal(liveRecords(restored.db, 'exercise').length, 0, '시드 종목은 복원에서도 올리지 않는다');
});

test('오프라인이면 오류 없이 대기 상태로 남는다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  server.hooks.offline = true;
  await createRoutine(a.ctx, '오프라인 루틴', []);
  const status = await a.engine.syncNow();
  assert.equal(status.state, 'offline');
  assert.equal(status.pending, 1);
  server.hooks.offline = false;
  assert.equal((await a.engine.syncNow()).state, 'synced');
  assert.equal(liveRecords(server.db, 'routine').length, 1);
});

test('401 이면 unauthorized, 등록하지 않은 기기는 서버에 요청하지 않는다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  server.hooks.unauthorized = true;
  assert.equal((await a.engine.syncNow()).state, 'unauthorized');
  const unpaired = await device(createFakeServer(), 'dev-u', { paired: false });
  const s2 = createFakeServer();
  const eng = createSyncEngine(unpaired.ctx, { fetch: s2.fetch, debounceMs: 0 });
  const st = await eng.syncNow();
  assert.equal(st.state, 'unauthorized');
  assert.equal(st.paired, false);
  assert.equal(s2.calls.length, 0);
});

test('markPaired 는 그동안 만든 모든 데이터를 올릴 대상으로 만든다 (시드 제외)', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a', { paired: false });
  await createRoutine(a.ctx, '페어링 전에 만든 루틴', []);
  await a.engine.markPaired();
  assert.equal((await listDirty(a.db, 'routines')).length, 1);
  assert.equal((await listDirty(a.db, 'exercises')).length, 0, '시드는 dirty 가 아니다');
  const status = await a.engine.syncNow();
  assert.equal(status.state, 'synced');
  assert.equal(liveRecords(server.db, 'routine').length, 1);
  assert.equal(liveRecords(server.db, 'exercise').length, 0);
});

test('시드 종목은 서버에서 온 삭제 표시에 진다', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  const b = await device(server, 'dev-b');
  const target = SEED_EXERCISES[3]!;
  const { deleteExercise } = await import('../src/exercises.ts');
  await deleteExercise(a.ctx, target.id);
  await a.engine.syncNow();
  await b.engine.syncNow();
  const onB = (await getExercise(b.db, target.id))!;
  assert.equal(onB.deleted, true);
  assert.ok(onB.version > SEED_VERSION);
  assert.equal((await listAllExercises(b.db)).filter((e: StoredExercise) => !e.deleted).length, SEED_EXERCISES.length - 1);
});

test('진행 중 세션도 동기화된다 (다른 기기에서는 읽기 전용으로만 보임)', async () => {
  const server = createFakeServer();
  const a = await device(server, 'dev-a');
  const b = await device(server, 'dev-b');
  const s = await startSession(a.ctx, null);
  await a.engine.syncNow();
  await b.engine.syncNow();
  const onB = (await getSession(b.db, s.id))!;
  assert.equal(onB.status, 'active');
  assert.equal(onB.startedBy, 'dev-a');
});
