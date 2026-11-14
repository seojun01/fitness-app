// 루틴 도메인: 생성·수정·복제·삭제와 항목 조작 (FR-001, FR-002, FR-013)
import { NAME_MAX, ROUTINE_ITEMS_MAX, TARGET_SETS_MAX, TARGET_SETS_MIN, validateRecord, type RoutineItem } from '../../shared/model.ts';
import type { Ctx } from './context.ts';
import { ValidationError, toValidationError } from './errors.ts';
import type { BodyPart } from '../../shared/model.ts';
import { lastPerformed, routineBodyParts } from '../../shared/stats.ts';
import type { StoredExercise, StoredRoutine } from './store/db.ts';
import { getExercise, getRoutine, listAllExercises, listAllRoutines, listAllSessions, saveRecords } from './store/records.ts';

export const DEFAULT_TARGET_SETS = 3;

const clampSets = (n: number) => Math.min(TARGET_SETS_MAX, Math.max(TARGET_SETS_MIN, Math.round(n)));

// ── 항목 조작 (순수 함수: 원본을 바꾸지 않는다) ──────────────────────

export function addItem(items: RoutineItem[], exerciseId: string, targetSets: number = DEFAULT_TARGET_SETS): RoutineItem[] {
  if (items.length >= ROUTINE_ITEMS_MAX) throw new ValidationError('items', `종목은 최대 ${ROUTINE_ITEMS_MAX}개까지 넣을 수 있어요`);
  return [...items, { exerciseId, targetSets: clampSets(targetSets) }];
}

export function removeItemAt(items: RoutineItem[], index: number): RoutineItem[] {
  return items.filter((_, i) => i !== index);
}

/** from 위치의 항목을 to 위치로 옮긴다 (범위를 넘으면 끝으로) */
export function moveItem(items: RoutineItem[], from: number, to: number): RoutineItem[] {
  if (from < 0 || from >= items.length) return items;
  const dest = Math.min(items.length - 1, Math.max(0, to));
  if (dest === from) return items;
  const next = [...items];
  const [it] = next.splice(from, 1);
  next.splice(dest, 0, it!);
  return next;
}

export function setTargetSets(items: RoutineItem[], index: number, targetSets: number): RoutineItem[] {
  return items.map((it, i) => (i === index ? { ...it, targetSets: clampSets(targetSets) } : it));
}

// ── 저장 ────────────────────────────────────────────────────────────

function check(rec: object): void {
  const { dirty: _dirty, ...plain } = rec as Record<string, unknown>;
  const errs = validateRecord('routine', { ...plain, deleted: false, version: 'v', updatedBy: 'x' });
  if (errs.length) throw toValidationError(errs);
}

export async function createRoutine(ctx: Ctx, name: string, items: RoutineItem[] = []): Promise<StoredRoutine> {
  const rec = { id: crypto.randomUUID(), name: name.trim(), items, createdAt: ctx.now().toISOString(), deleted: false };
  check(rec);
  return (await saveRecords(ctx, { routines: [rec as never] })).routines[0]!;
}

export async function updateRoutine(ctx: Ctx, id: string, patch: { name?: string; items?: RoutineItem[] }): Promise<StoredRoutine> {
  const cur = await getRoutine(ctx.db, id);
  if (!cur || cur.deleted) throw new Error('루틴을 찾을 수 없어요');
  const next = { ...cur, name: (patch.name ?? cur.name).trim(), items: patch.items ?? cur.items };
  check(next);
  return (await saveRecords(ctx, { routines: [next] })).routines[0]!;
}

export async function duplicateRoutine(ctx: Ctx, id: string): Promise<StoredRoutine> {
  const cur = await getRoutine(ctx.db, id);
  if (!cur || cur.deleted) throw new Error('루틴을 찾을 수 없어요');
  const suffix = ' 복사';
  const base = [...cur.name].slice(0, NAME_MAX - [...suffix].length).join('');
  return createRoutine(ctx, base + suffix, cur.items.map((it) => ({ ...it })));
}

/** 삭제는 툼스톤이다. 과거 세션은 routineName 을 복사해 두었으므로 영향이 없다 (FR-013) */
export async function deleteRoutine(ctx: Ctx, id: string): Promise<void> {
  const cur = await getRoutine(ctx.db, id);
  if (!cur || cur.deleted) return;
  await saveRecords(ctx, { routines: [{ ...cur, deleted: true }] });
}

export async function restoreRoutine(ctx: Ctx, id: string): Promise<void> {
  const cur = await getRoutine(ctx.db, id);
  if (!cur || !cur.deleted) return;
  await saveRecords(ctx, { routines: [{ ...cur, deleted: false }] });
}

/** 삭제되지 않은 루틴, 만든 순서 */
export async function listRoutines(db: IDBDatabase): Promise<StoredRoutine[]> {
  return (await listAllRoutines(db)).filter((r) => !r.deleted).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}

/** 편집 화면용: 삭제되지 않은 루틴 하나 */
export async function getRoutineForEdit(db: IDBDatabase, id: string): Promise<StoredRoutine | undefined> {
  const r = await getRoutine(db, id);
  return r && !r.deleted ? r : undefined;
}

export interface ResolvedItem {
  item: RoutineItem;
  /** 삭제됐거나 없는 종목이면 null ("삭제된 종목") */
  exercise: StoredExercise | null;
}

export async function resolveItems(db: IDBDatabase, routine: StoredRoutine): Promise<ResolvedItem[]> {
  const out: ResolvedItem[] = [];
  for (const item of routine.items) {
    const ex = await getExercise(db, item.exerciseId);
    out.push({ item, exercise: ex && !ex.deleted ? ex : null });
  }
  return out;
}

// ── 루틴 카드 (기능 3, research W7) ─────────────────────────────────

export type RoutineSort = 'recent' | 'name';

export interface RoutineCard {
  routine: StoredRoutine;
  bodyParts: BodyPart[];
  /** 그 루틴으로 마지막으로 완료한 세션의 endedAt, 없으면 null */
  lastPerformed: string | null;
}

export async function listRoutineCards(db: IDBDatabase, sort: RoutineSort = 'recent'): Promise<RoutineCard[]> {
  const [routines, exercises, sessions] = await Promise.all([listRoutines(db), listAllExercises(db), listAllSessions(db)]);
  const exMap = new Map(exercises.map((e) => [e.id, e]));
  const cards = routines.map((routine) => ({ routine, bodyParts: routineBodyParts(routine, exMap), lastPerformed: lastPerformed(routine.id, sessions) }));
  if (sort === 'name') return cards.sort((a, b) => a.routine.name.localeCompare(b.routine.name, 'ko'));
  // 최근 순: 마지막 수행일 내림차순, 기록 없는 루틴은 뒤에서 만든 순서 (listRoutines 의 순서를 유지하는 안정 정렬)
  return cards.sort((a, b) => {
    if (a.lastPerformed && b.lastPerformed) return b.lastPerformed.localeCompare(a.lastPerformed);
    if (a.lastPerformed) return -1;
    if (b.lastPerformed) return 1;
    return 0;
  });
}

/** 루틴 맨 뒤에 종목을 추가한다 (루틴 상세의 "운동 추가") */
export async function appendExercise(ctx: Ctx, routineId: string, exerciseId: string): Promise<StoredRoutine> {
  const cur = await getRoutine(ctx.db, routineId);
  if (!cur || cur.deleted) throw new Error('루틴을 찾을 수 없어요');
  return updateRoutine(ctx, routineId, { items: addItem(cur.items, exerciseId) });
}
