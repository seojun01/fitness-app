import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from '../../shared/model.ts';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import { getBuiltinGuide } from '../../shared/guides.ts';
import { buildCatalog, equipmentOf, filterCatalog, tagLabel, usageStats } from '../src/exercise-catalog.ts';
import type { StoredExercise, StoredGuideNote } from '../src/store/db.ts';

const seed = (name: string) => ({ ...SEED_EXERCISES.find((e) => e.name === name)!, dirty: 0 as const }) as StoredExercise;
const custom = (over: Partial<StoredExercise> = {}): StoredExercise => ({
  id: crypto.randomUUID(), name: '내 운동', bodyPart: 'arms', custom: true, bodyweight: false, deleted: false, version: 'v', updatedBy: 'd', dirty: 0, ...over,
});
let n = 0;
const session = (endedAt: string | null, exIds: string[], over: Partial<Session> = {}): Session => ({
  id: `s${++n}`, status: endedAt ? 'completed' : 'active', routineId: null, routineName: null, startedAt: endedAt ?? '2026-11-14T00:00:00.000Z', endedAt, startedBy: 'd',
  entries: exIds.map((exerciseId) => ({ entryId: crypto.randomUUID(), exerciseId, exerciseName: 'x', sets: [] })), deleted: false, version: 'v', updatedBy: 'd', ...over,
});

test('usageStats: 완료(삭제 안 된) 세션만 세고, 세션 안 중복은 한 번', () => {
  const a = seed('벤치 프레스').id;
  const b = seed('스쿼트').id;
  const stats = usageStats([
    session('2026-11-01T10:00:00.000Z', [a, a]),
    session('2026-11-05T10:00:00.000Z', [a, b]),
    session(null, [b]),
    session('2026-11-09T10:00:00.000Z', [b], { deleted: true }),
  ]);
  assert.deepEqual(stats.get(a), { count: 2, lastUsed: '2026-11-05T10:00:00.000Z' });
  assert.deepEqual(stats.get(b), { count: 1, lastUsed: '2026-11-05T10:00:00.000Z' });
});

test('equipmentOf: 레코드 값 → 기본 종목 목록 → 맨몸/기타', () => {
  const bench = seed('벤치 프레스');
  assert.equal(equipmentOf(bench), 'barbell');
  const { equipment: _e, ...noEq } = bench;
  assert.equal(equipmentOf(noEq as StoredExercise), 'barbell', '고친 기본 종목에 장비가 없어도 목록에서 찾는다');
  assert.equal(equipmentOf(custom({ bodyweight: true })), 'bodyweight');
  assert.equal(equipmentOf(custom()), 'other');
  assert.equal(equipmentOf(custom({ equipment: 'band' })), 'band');
});

function catalog(extra: StoredExercise[] = [], notes: StoredGuideNote[] = [], sessions: Session[] = []) {
  const exercises = [...SEED_EXERCISES.map((e) => ({ ...e, dirty: 0 as const }) as StoredExercise), ...extra];
  return buildCatalog(exercises, getBuiltinGuide, notes, sessions);
}

test('태그: 기본 종목은 가이드의 주동근 → 보조근 그룹, 화면에는 2개까지', () => {
  const items = catalog();
  const lat = items.find((i) => i.exercise.name === '랫 풀다운')!;
  assert.deepEqual(lat.groups.slice(0, 2), ['back', 'biceps']);
  assert.equal(tagLabel(lat), '등, 이두');
  const bench = items.find((i) => i.exercise.name === '벤치 프레스')!;
  assert.equal(tagLabel(bench), '가슴, 어깨');
  assert.ok(bench.groups.includes('triceps'));
});

test('태그: 직접 만든 종목은 노트 근육 → 없으면 부위', () => {
  const a = custom({ name: 'A', bodyPart: 'legs' });
  const b = custom({ name: 'B', bodyPart: 'legs' });
  const note: StoredGuideNote = { id: b.id, cues: [], mistakes: [], primaryMuscles: ['glutes'], secondaryMuscles: [], deleted: false, version: 'v', updatedBy: 'd', dirty: 0 };
  const items = catalog([a, b], [note]);
  assert.deepEqual(items.find((i) => i.exercise.id === a.id)!.groups, ['quads', 'glutes', 'hamstrings', 'calves']);
  assert.deepEqual(items.find((i) => i.exercise.id === b.id)!.groups, ['glutes']);
});

test('필터: 근육 부위(주동·보조 모두) × 장비 × 검색어 조합, 삭제된 종목 제외', () => {
  const items = catalog([custom({ name: '지운 운동', deleted: true })]);
  const triceps = filterCatalog(items, { group: 'triceps' }).map((i) => i.exercise.name);
  assert.ok(triceps.includes('벤치 프레스'), '보조근도 포함');
  assert.ok(triceps.includes('트라이셉스 푸시다운'));
  assert.deepEqual(filterCatalog(items, { group: 'biceps', equipment: 'cable', query: '컬' }).map((i) => i.exercise.name), ['케이블 컬']);
  assert.ok(filterCatalog(items, { equipment: 'smith' }).every((i) => i.equipment === 'smith'));
  assert.equal(filterCatalog(items, { query: '지운' }).length, 0);
  assert.deepEqual(filterCatalog(items, { query: '케이블컬' }).map((i) => i.exercise.name), ['케이블 컬'], '공백 무시');
});

test('분류: 좋아하는·자주하는(많은 순)·최근(최근 순)·커스텀', () => {
  const fav = { ...seed('스쿼트'), favorite: true };
  const mine = custom({ name: 'Z 내 운동' });
  const a = seed('벤치 프레스').id;
  const b = seed('데드리프트').id;
  const sessions = [session('2026-11-01T10:00:00.000Z', [a]), session('2026-11-02T10:00:00.000Z', [a]), session('2026-11-10T10:00:00.000Z', [b])]; // 벤치 2회, 데드 1회(더 최근)
  const items = catalog([mine], [], sessions).map((i) => (i.exercise.id === fav.id ? { ...i, exercise: fav } : i));
  assert.deepEqual(filterCatalog(items, { category: 'favorite' }).map((i) => i.exercise.name), ['스쿼트']);
  assert.deepEqual(filterCatalog(items, { category: 'frequent' }).map((i) => i.exercise.name), ['벤치 프레스', '데드리프트']);
  assert.deepEqual(filterCatalog(items, { category: 'recent' }).map((i) => i.exercise.name), ['데드리프트', '벤치 프레스']);
  assert.deepEqual(filterCatalog(items, { category: 'custom' }).map((i) => i.exercise.name), ['Z 내 운동']);
  const all = filterCatalog(items, {});
  assert.equal(all.length, SEED_EXERCISES.length + 1);
  assert.deepEqual(all.map((i) => i.exercise.name), [...all.map((i) => i.exercise.name)].sort((x, y) => x.localeCompare(y, 'ko')), '전체는 이름순');
});
