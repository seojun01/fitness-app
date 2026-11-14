import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { createCtx } from '../src/context.ts';
import { createExercise, deleteExercise, restoreExercise } from '../src/exercises.ts';
import { ValidationError } from '../src/errors.ts';
import { eraseAllData, exportAllData } from '../src/export.ts';
import { resolveGuide, saveGuideNote } from '../src/guides.ts';
import { commit, listDirty, openFitnessDb } from '../src/store/db.ts';
import { getMeta } from '../src/store/meta.ts';
import { ensureSeed, getGuideNote, getRoutine } from '../src/store/records.ts';
import { createSyncEngine } from '../src/sync/engine.ts';
import { createFakeServer } from './helpers/fake-server.ts';
import { liveRecords } from '../../server/src/sync.ts';

async function setup(name = `fitness-gn-${Math.random()}`, deviceId = 'dev-1') {
  const db = await openFitnessDb(name);
  await ensureSeed(db);
  return createCtx(db, { deviceId });
}

test('노트 저장: 빈 항목 제거·공백 정리, 새 version·dirty, resolveGuide 가 note 를 돌려준다', async () => {
  const ctx = await setup();
  const ex = await createExercise(ctx, { name: '내 운동', bodyPart: 'arms' });
  assert.equal((await resolveGuide(ctx.db, ex.id)).kind, 'none');
  const saved = await saveGuideNote(ctx, ex.id, { cues: ['  팔꿈치 고정 ', '', '천천히'], mistakes: ['반동'], primaryMuscles: ['biceps'], secondaryMuscles: ['forearms'] });
  assert.deepEqual(saved!.cues, ['팔꿈치 고정', '천천히']);
  assert.equal(saved!.dirty, 1);
  const g = await resolveGuide(ctx.db, ex.id);
  assert.equal(g.kind, 'note');
  assert.deepEqual(g.kind === 'note' && g.note.primaryMuscles, ['biceps']);
});

test('모두 비우면 툼스톤이 되고 "가이드 없음"으로 돌아간다', async () => {
  const ctx = await setup();
  const ex = await createExercise(ctx, { name: '내 운동', bodyPart: 'arms' });
  await saveGuideNote(ctx, ex.id, { cues: ['하나'], mistakes: [], primaryMuscles: [], secondaryMuscles: [] });
  await saveGuideNote(ctx, ex.id, { cues: ['  '], mistakes: [], primaryMuscles: [], secondaryMuscles: [] });
  assert.equal((await getGuideNote(ctx.db, ex.id))!.deleted, true);
  assert.equal((await resolveGuide(ctx.db, ex.id)).kind, 'none');
});

test('기본 종목에는 노트를 저장할 수 없고, 기본 가이드가 나온다', async () => {
  const ctx = await setup();
  const seed = SEED_EXERCISES[0]!;
  await assert.rejects(saveGuideNote(ctx, seed.id, { cues: ['x'], mistakes: [], primaryMuscles: [], secondaryMuscles: [] }));
  const g = await resolveGuide(ctx.db, seed.id);
  assert.equal(g.kind, 'builtin');
});

test('잘못된 노트(겹치는 근육, 201자)는 ValidationError', async () => {
  const ctx = await setup();
  const ex = await createExercise(ctx, { name: '내 운동', bodyPart: 'legs' });
  await assert.rejects(saveGuideNote(ctx, ex.id, { cues: [], mistakes: [], primaryMuscles: ['quads'], secondaryMuscles: ['quads'] }), ValidationError);
  await assert.rejects(saveGuideNote(ctx, ex.id, { cues: ['가'.repeat(201)], mistakes: [], primaryMuscles: [], secondaryMuscles: [] }), ValidationError);
  assert.equal(await getGuideNote(ctx.db, ex.id), undefined);
});

test('종목을 삭제하면 가이드도 숨고, 되돌리면 다시 보인다', async () => {
  const ctx = await setup();
  const ex = await createExercise(ctx, { name: '내 운동', bodyPart: 'core' });
  await saveGuideNote(ctx, ex.id, { cues: ['배에 힘'], mistakes: [], primaryMuscles: ['abs'], secondaryMuscles: [] });
  await deleteExercise(ctx, ex.id);
  assert.equal((await resolveGuide(ctx.db, ex.id)).kind, 'none');
  await restoreExercise(ctx, ex.id);
  assert.equal((await resolveGuide(ctx.db, ex.id)).kind, 'note');
});

test('IndexedDB v1(기능 1·3 스키마)을 v2 로 열면 기존 레코드가 남고 guideNotes 가 생기며 cursor 가 0 이 된다', async () => {
  const name = `fitness-upgrade-${Math.random()}`;
  const routine = { id: '00000000-0000-4000-8000-000000000123', name: '옛 루틴', items: [], createdAt: '2026-11-01T00:00:00.000Z', deleted: false, version: 'v', updatedBy: 'd', dirty: 0 };
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open(name, 1);
    open.onupgradeneeded = () => {
      const db = open.result;
      for (const s of ['exercises', 'routines', 'sessions', 'settings']) {
        const st = db.createObjectStore(s, { keyPath: 'id' });
        st.createIndex('byDirty', 'dirty');
        if (s === 'sessions') {
          st.createIndex('byStatus', 'status');
          st.createIndex('byEndedAt', 'endedAt');
        }
      }
      db.createObjectStore('meta');
    };
    open.onsuccess = () => {
      const tx = open.result.transaction(['routines', 'meta'], 'readwrite');
      tx.objectStore('routines').put(routine);
      tx.objectStore('meta').put(57, 'cursor');
      tx.oncomplete = () => {
        open.result.close();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    };
    open.onerror = () => reject(open.error);
  });
  const db = await openFitnessDb(name);
  assert.deepEqual(await getRoutine(db, routine.id), routine);
  assert.ok(db.objectStoreNames.contains('guideNotes'));
  assert.equal(await getMeta(db, 'cursor'), 0);
});

test('동기화 엔진이 guideNote 를 push·pull 한다', async () => {
  const server = createFakeServer();
  const a = await setup(undefined, 'dev-a');
  const b = await setup(undefined, 'dev-b');
  for (const c of [a, b]) await commit(c.db, { meta: { paired: true } }, { silent: true });
  const ex = await createExercise(a, { name: '공유 운동', bodyPart: 'back' });
  await saveGuideNote(a, ex.id, { cues: ['가슴을 편다'], mistakes: [], primaryMuscles: ['lats'], secondaryMuscles: [] });
  await createSyncEngine(a, { fetch: server.fetch, debounceMs: 0 }).syncNow();
  assert.equal(liveRecords(server.db, 'guideNote').length, 1);
  await createSyncEngine(b, { fetch: server.fetch, debounceMs: 0 }).syncNow();
  const g = await resolveGuide(b.db, ex.id);
  assert.equal(g.kind, 'note');
  assert.equal((await listDirty(b.db, 'guideNotes')).length, 0);
});

test('내보내기에 노트가 들어가고, 전체 삭제는 노트를 툼스톤으로 만든다', async () => {
  const ctx = await setup();
  const ex = await createExercise(ctx, { name: '내 운동', bodyPart: 'arms' });
  await saveGuideNote(ctx, ex.id, { cues: ['하나'], mistakes: [], primaryMuscles: [], secondaryMuscles: [] });
  const out = await exportAllData(ctx.db);
  assert.equal(out.version, 2);
  assert.deepEqual(out.guideNotes, [{ id: ex.id, cues: ['하나'], mistakes: [], primaryMuscles: [], secondaryMuscles: [] }]);
  await eraseAllData(ctx);
  const n = (await getGuideNote(ctx.db, ex.id))!;
  assert.deepEqual(Object.keys(n).sort(), ['deleted', 'dirty', 'id', 'updatedBy', 'version']);
  assert.equal((await exportAllData(ctx.db)).guideNotes.length, 0);
});
