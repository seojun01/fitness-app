import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRecord } from '../model.ts';

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = { deleted: false, version: '000000000000001-000000-dev', updatedBy: 'dev' };

const exercise = (o: Record<string, unknown> = {}) => ({ id: U(1), name: '벤치 프레스', bodyPart: 'chest', custom: false, bodyweight: false, ...base, ...o });
const routine = (o: Record<string, unknown> = {}) => ({ id: U(2), name: '가슴·삼두', items: [{ exerciseId: U(1), targetSets: 3 }], createdAt: '2026-11-14T00:00:00.000Z', ...base, ...o });
const set = (o: Record<string, unknown> = {}) => ({ setId: U(4), weightKg: 60, reps: 10, done: true, ...o });
const session = (o: Record<string, unknown> = {}) => ({
  id: U(3), status: 'completed', routineId: null, routineName: null, startedAt: '2026-11-14T10:00:00.000Z', endedAt: '2026-11-14T11:00:00.000Z',
  startedBy: 'dev', entries: [{ entryId: U(5), exerciseId: U(1), exerciseName: '벤치 프레스', sets: [set()] }], ...base, ...o,
});
const ok = (type: string, r: unknown) => assert.deepEqual(validateRecord(type, r), []);
const bad = (type: string, r: unknown, field: string) => {
  const errs = validateRecord(type, r);
  assert.ok(errs.some((e) => e.field === field), `${field} 오류가 있어야 한다: ${JSON.stringify(errs)}`);
};

test('유효한 레코드는 통과한다', () => {
  ok('exercise', exercise());
  ok('routine', routine());
  ok('session', session());
  ok('settings', { id: 'settings', weightUnit: 'lb', ...base });
});

test('이름은 공백 제거 후 1~60자(코드 포인트)', () => {
  bad('exercise', exercise({ name: '' }), 'name');
  bad('exercise', exercise({ name: '   ' }), 'name');
  bad('routine', routine({ name: 'a'.repeat(61) }), 'name');
  ok('routine', routine({ name: 'a'.repeat(60) }));
  ok('routine', routine({ name: '😀'.repeat(60) })); // 코드 포인트 60개
  bad('routine', routine({ name: '😀'.repeat(61) }), 'name');
  ok('routine', routine({ name: '  가슴  ' }));
});

test('루틴 항목은 0~50개, targetSets 는 1~20', () => {
  ok('routine', routine({ items: [] }));
  const item = { exerciseId: U(1), targetSets: 3 };
  ok('routine', routine({ items: Array(50).fill(item) }));
  bad('routine', routine({ items: Array(51).fill(item) }), 'items');
  bad('routine', routine({ items: [{ exerciseId: U(1), targetSets: 0 }] }), 'items[0].targetSets');
  bad('routine', routine({ items: [{ exerciseId: U(1), targetSets: 21 }] }), 'items[0].targetSets');
  ok('routine', routine({ items: [{ exerciseId: U(1), targetSets: 20 }] }));
  bad('routine', routine({ items: [{ exerciseId: U(1), targetSets: 2.5 }] }), 'items[0].targetSets');
});

test('weightKg 는 0 이상 1000 이하', () => {
  const w = (weightKg: number) => session({ entries: [{ entryId: U(5), exerciseId: U(1), exerciseName: 'x', sets: [set({ weightKg })] }] });
  ok('session', w(0));
  ok('session', w(1000));
  ok('session', w(2.5));
  bad('session', w(-1), 'entries[0].sets[0].weightKg');
  bad('session', w(1001), 'entries[0].sets[0].weightKg');
  bad('session', w(Number.NaN), 'entries[0].sets[0].weightKg');
});

test('reps 는 1 이상 999 이하 정수', () => {
  const r = (reps: number) => session({ entries: [{ entryId: U(5), exerciseId: U(1), exerciseName: 'x', sets: [set({ reps })] }] });
  ok('session', r(1));
  ok('session', r(999));
  bad('session', r(0), 'entries[0].sets[0].reps');
  bad('session', r(1.5), 'entries[0].sets[0].reps');
  bad('session', r(1000), 'entries[0].sets[0].reps');
  bad('session', r(-3), 'entries[0].sets[0].reps');
});

test('세션 entries 0~50개, 항목당 sets 0~50개', () => {
  const entry = { entryId: U(5), exerciseId: U(1), exerciseName: 'x', sets: [] };
  ok('session', session({ entries: [] }));
  ok('session', session({ entries: Array(50).fill(entry) }));
  bad('session', session({ entries: Array(51).fill(entry) }), 'entries');
  ok('session', session({ entries: [{ ...entry, sets: Array(50).fill(set()) }] }));
  bad('session', session({ entries: [{ ...entry, sets: Array(51).fill(set()) }] }), 'entries[0].sets');
});

test('completed 이면 endedAt 필수이고 endedAt ≥ startedAt', () => {
  bad('session', session({ endedAt: null }), 'endedAt');
  bad('session', session({ endedAt: '2026-11-14T09:59:59.000Z' }), 'endedAt');
  ok('session', session({ endedAt: '2026-11-14T10:00:00.000Z' }));
  ok('session', session({ status: 'active', endedAt: null }));
  bad('session', session({ status: 'active' }), 'endedAt');
});

test('알 수 없는 type 과 필드는 거부한다', () => {
  assert.ok(validateRecord('task', exercise()).some((e) => e.field === 'type'));
  bad('exercise', exercise({ color: 'red' }), 'color');
  bad('session', session({ entries: [{ entryId: U(5), exerciseId: U(1), exerciseName: 'x', sets: [set({ rpe: 8 })] }] }), 'entries[0].sets[0].rpe');
});

test('툼스톤은 id·version·updatedBy 만 있어도 통과한다', () => {
  for (const type of ['exercise', 'routine', 'session']) ok(type, { id: U(9), deleted: true, version: '000000000000002-000000-dev', updatedBy: 'dev' });
  ok('settings', { id: 'settings', deleted: true, version: '000000000000002-000000-dev', updatedBy: 'dev' });
  bad('session', { id: 'nope', deleted: true, version: 'v', updatedBy: 'dev' }, 'id');
  bad('session', { id: U(9), deleted: true, updatedBy: 'dev' }, 'version');
});

test('settings 는 weightUnit 이 kg 또는 lb, id 는 "settings"', () => {
  ok('settings', { id: 'settings', weightUnit: 'kg', ...base });
  bad('settings', { id: 'settings', weightUnit: 'stone', ...base }, 'weightUnit');
  bad('settings', { id: U(1), weightUnit: 'kg', ...base }, 'id');
});

test('bodyPart 는 정해진 값만', () => {
  bad('exercise', exercise({ bodyPart: 'neck' }), 'bodyPart');
});

test('완료되지 않은 세트는 무게·횟수가 비어(null) 있을 수 있지만, 완료된 세트는 반드시 유효해야 한다', () => {
  const sess = (sets: unknown[]) => session({ entries: [{ entryId: U(5), exerciseId: U(1), exerciseName: 'x', sets }] });
  ok('session', sess([set({ done: false, weightKg: null, reps: null })]));
  ok('session', sess([set({ done: false, weightKg: 20, reps: null })]));
  bad('session', sess([set({ done: true, weightKg: null })]), 'entries[0].sets[0].weightKg');
  bad('session', sess([set({ done: true, reps: null })]), 'entries[0].sets[0].reps');
  bad('session', sess([set({ done: false, reps: 0 })]), 'entries[0].sets[0].reps'); // 값이 있으면 규칙을 지켜야 한다
});

test('exercise.memo: 선택, 문자열, 0~500자(코드 포인트)', () => {
  ok('exercise', exercise({ memo: '' }));
  ok('exercise', exercise({ memo: '의자 높이 4\n그립 넓게' }));
  ok('exercise', exercise({ memo: '가'.repeat(500) }));
  ok('exercise', exercise({ memo: '😀'.repeat(500) }));
  bad('exercise', exercise({ memo: '가'.repeat(501) }), 'memo');
  bad('exercise', exercise({ memo: 3 }), 'memo');
  ok('exercise', exercise()); // 필드가 없어도 된다
});

test('settings.restSeconds: 선택, 정수, 15~600, 15의 배수', () => {
  for (const v of [15, 60, 90, 600]) ok('settings', { id: 'settings', weightUnit: 'kg', restSeconds: v, ...base });
  for (const v of [10, 601, 50, 0, 62.5, '60']) bad('settings', { id: 'settings', weightUnit: 'kg', restSeconds: v, ...base }, 'restSeconds');
  ok('settings', { id: 'settings', weightUnit: 'kg', ...base });
});
