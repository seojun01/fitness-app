import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCtx } from '../src/context.ts';
import { openFitnessDb } from '../src/store/db.ts';
import { ensureSeed, getRoutine } from '../src/store/records.ts';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import {
  addItem, createRoutine, deleteRoutine, duplicateRoutine, listRoutines, moveItem, removeItemAt, resolveItems, restoreRoutine, setTargetSets, updateRoutine,
} from '../src/routines.ts';
import { createExercise, deleteExercise, listExercises, renameExercise, restoreExercise } from '../src/exercises.ts';
import { ValidationError } from '../src/errors.ts';

let n = 0;
async function setup() {
  const db = await openFitnessDb(`fitness-routines-${++n}-${Math.random()}`);
  await ensureSeed(db);
  const ctx = await createCtx(db, { deviceId: 'dev-1' });
  return ctx;
}
const [A, B, C] = [SEED_EXERCISES[0]!.id, SEED_EXERCISES[1]!.id, SEED_EXERCISES[2]!.id];

test('루틴 생성: 이름은 공백 제거 후 1~60자', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '  가슴·삼두  ', [{ exerciseId: A, targetSets: 3 }]);
  assert.equal(r.name, '가슴·삼두');
  assert.equal(r.dirty, 1);
  assert.equal(r.deleted, false);
  await assert.rejects(createRoutine(ctx, '   ', []), (e) => e instanceof ValidationError && e.field === 'name');
  await assert.rejects(createRoutine(ctx, 'a'.repeat(61), []), (e) => e instanceof ValidationError && e.field === 'name');
  assert.ok(await createRoutine(ctx, 'a'.repeat(60), []));
});

test('항목 추가·삭제·순서 변경 (items 0~50개, targetSets 1~20)', () => {
  let items = addItem([], A);
  items = addItem(items, B, 4);
  items = addItem(items, C);
  assert.deepEqual(items.map((i) => i.exerciseId), [A, B, C]);
  assert.equal(items[0]!.targetSets, 3);
  assert.equal(items[1]!.targetSets, 4);
  assert.deepEqual(moveItem(items, 2, 0).map((i) => i.exerciseId), [C, A, B]);
  assert.deepEqual(moveItem(items, 0, 1).map((i) => i.exerciseId), [B, A, C]);
  assert.deepEqual(moveItem(items, 0, 0), items);
  assert.deepEqual(moveItem(items, 0, 99).map((i) => i.exerciseId), [B, C, A]); // 범위를 넘으면 끝으로
  assert.deepEqual(removeItemAt(items, 1).map((i) => i.exerciseId), [A, C]);
  assert.equal(setTargetSets(items, 0, 20)[0]!.targetSets, 20);
  assert.equal(setTargetSets(items, 0, 21)[0]!.targetSets, 20, '상한 20 으로 맞춘다');
  assert.equal(setTargetSets(items, 0, 0)[0]!.targetSets, 1, '하한 1 로 맞춘다');
  assert.equal(items.length, 3, '원본은 바뀌지 않는다');
  let full = [] as typeof items;
  for (let i = 0; i < 50; i++) full = addItem(full, A);
  assert.throws(() => addItem(full, A), ValidationError);
});

test('항목 순서 변경과 삭제가 저장된다', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '루틴', [A, B, C].map((id) => ({ exerciseId: id, targetSets: 3 })));
  const saved = await updateRoutine(ctx, r.id, { items: moveItem(removeItemAt(r.items, 0), 1, 0) });
  assert.deepEqual(saved.items.map((i) => i.exerciseId), [C, B]);
  assert.deepEqual((await getRoutine(ctx.db, r.id))!.items.map((i) => i.exerciseId), [C, B]);
  assert.ok(saved.version > r.version);
});

test('복제: 새 id, 이름 "<원본> 복사"(60자 초과 시 자름), items 깊은 복사, 원본 불변', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '푸시 데이', [{ exerciseId: A, targetSets: 5 }]);
  const copy = await duplicateRoutine(ctx, r.id);
  assert.notEqual(copy.id, r.id);
  assert.equal(copy.name, '푸시 데이 복사');
  assert.deepEqual(copy.items, r.items);
  const edited = await updateRoutine(ctx, copy.id, { items: setTargetSets(copy.items, 0, 8) });
  assert.equal(edited.items[0]!.targetSets, 8);
  assert.equal((await getRoutine(ctx.db, r.id))!.items[0]!.targetSets, 5);

  const long = await createRoutine(ctx, 'ㄱ'.repeat(60), []);
  const longCopy = await duplicateRoutine(ctx, long.id);
  assert.equal([...longCopy.name].length, 60);
  assert.ok(longCopy.name.endsWith('복사') || longCopy.name.startsWith('ㄱ'));
});

test('삭제는 툼스톤이고 목록에서 사라지며, 되돌리면 돌아온다', async () => {
  const ctx = await setup();
  const r = await createRoutine(ctx, '삭제할 루틴', []);
  const keep = await createRoutine(ctx, '남길 루틴', []);
  await deleteRoutine(ctx, r.id);
  assert.equal((await getRoutine(ctx.db, r.id))!.deleted, true);
  assert.deepEqual((await listRoutines(ctx.db)).map((x) => x.id), [keep.id]);
  await restoreRoutine(ctx, r.id);
  assert.equal((await listRoutines(ctx.db)).length, 2);
});

test('목록은 만든 순서이고 삭제된 종목을 가리키는 항목은 "삭제된 종목"으로 해석된다', async () => {
  const ctx = await setup();
  const mine = await createExercise(ctx, { name: '내 종목', bodyPart: 'arms' });
  const r = await createRoutine(ctx, '루틴', [{ exerciseId: mine.id, targetSets: 3 }, { exerciseId: A, targetSets: 2 }]);
  let resolved = await resolveItems(ctx.db, r);
  assert.deepEqual(resolved.map((x) => x.exercise?.name), ['내 종목', SEED_EXERCISES[0]!.name]);
  await deleteExercise(ctx, mine.id);
  resolved = await resolveItems(ctx.db, r);
  assert.equal(resolved[0]!.exercise, null);
  assert.equal(resolved[1]!.exercise?.id, A);
});

test('종목: 직접 만들기(custom), 이름 수정, 삭제·복구, 이름 1~60자', async () => {
  const ctx = await setup();
  const e = await createExercise(ctx, { name: '  케이블 컬 ', bodyPart: 'arms' });
  assert.equal(e.name, '케이블 컬');
  assert.equal(e.custom, true);
  assert.equal(e.bodyPart, 'arms');
  await assert.rejects(createExercise(ctx, { name: '', bodyPart: 'arms' }), ValidationError);
  await assert.rejects(createExercise(ctx, { name: 'x'.repeat(61), bodyPart: 'arms' }), ValidationError);
  const renamed = await renameExercise(ctx, e.id, '로프 컬');
  assert.equal(renamed.name, '로프 컬');
  await deleteExercise(ctx, e.id);
  assert.ok(!(await listExercises(ctx.db)).some((x) => x.id === e.id));
  await restoreExercise(ctx, e.id);
  assert.ok((await listExercises(ctx.db)).some((x) => x.id === e.id));
  // 기본 종목도 삭제할 수 있다
  await deleteExercise(ctx, A);
  assert.ok(!(await listExercises(ctx.db)).some((x) => x.id === A));
});

test('루틴 카드: 부위 요약과 마지막 수행일, 최근 순(기록 없는 루틴은 뒤·만든 순서)과 이름 순', async () => {
  const { listRoutineCards } = await import('../src/routines.ts');
  const { startSession, updateSet, finishSession } = await import('../src/sessions.ts');
  let t = new Date('2026-11-10T10:00:00.000Z');
  const db = await openFitnessDb(`fitness-cards-${Math.random()}`);
  await ensureSeed(db);
  const ctx = await createCtx(db, { deviceId: 'dev-1', now: () => t });
  const back = SEED_EXERCISES.find((e) => e.bodyPart === 'back')!;
  const arms = SEED_EXERCISES.find((e) => e.bodyPart === 'arms')!;
  const pull = await createRoutine(ctx, '풀', [{ exerciseId: back.id, targetSets: 1 }, { exerciseId: arms.id, targetSets: 1 }, { exerciseId: back.id, targetSets: 1 }]);
  t = new Date('2026-11-10T10:01:00.000Z');
  const legs = await createRoutine(ctx, '다리', []);
  t = new Date('2026-11-10T10:02:00.000Z');
  const abc = await createRoutine(ctx, '가슴', []);
  let s = await startSession(ctx, pull);
  s = await updateSet(ctx, s.id, s.entries[0]!.entryId, s.entries[0]!.sets[0]!.setId, { weightKg: 10, reps: 10, done: true });
  t = new Date('2026-11-12T10:00:00.000Z');
  await finishSession(ctx, s.id, { ifEmpty: 'save' });

  const recent = await listRoutineCards(db, 'recent');
  assert.deepEqual(recent.map((c) => c.routine.name), ['풀', '다리', '가슴']);
  assert.deepEqual(recent[0]!.bodyParts, ['back', 'arms']);
  assert.equal(recent[0]!.lastPerformed, '2026-11-12T10:00:00.000Z');
  assert.equal(recent[1]!.lastPerformed, null);
  const byName = await listRoutineCards(db, 'name');
  assert.deepEqual(byName.map((c) => c.routine.name), ['가슴', '다리', '풀']);
  void legs;
  void abc;
});

test('appendExercise: 루틴 맨 뒤에 종목을 추가한다', async () => {
  const { appendExercise } = await import('../src/routines.ts');
  const ctx = await setup();
  const r = await createRoutine(ctx, 'r', [{ exerciseId: A, targetSets: 3 }]);
  const saved = await appendExercise(ctx, r.id, B);
  assert.deepEqual(saved.items.map((i) => i.exerciseId), [A, B]);
  assert.equal(saved.items[1]!.targetSets, 3);
});
