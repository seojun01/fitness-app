// 운동 종목: 직접 만들기, 이름 수정, 삭제·복구 (FR-003)
import { BODY_PARTS, validateRecord, type BodyPart, type Equipment } from '../../shared/model.ts';
import type { Ctx } from './context.ts';
import { toValidationError } from './errors.ts';
import type { StoredExercise } from './store/db.ts';
import { getExercise, listAllExercises, saveRecords } from './store/records.ts';

const ORDER = new Map<string, number>(BODY_PARTS.map((p, i) => [p, i]));

function check(rec: object): void {
  const { dirty: _dirty, ...plain } = rec as Record<string, unknown>;
  const errs = validateRecord('exercise', { ...plain, version: 'v', updatedBy: 'x' });
  if (errs.length) throw toValidationError(errs);
}

/** 삭제되지 않은 종목: 부위 순서 → 이름순 */
export async function listExercises(db: IDBDatabase): Promise<StoredExercise[]> {
  return (await listAllExercises(db))
    .filter((e) => !e.deleted)
    .sort((a, b) => (ORDER.get(a.bodyPart) ?? 99) - (ORDER.get(b.bodyPart) ?? 99) || a.name.localeCompare(b.name, 'ko'));
}

export async function createExercise(ctx: Ctx, input: { name: string; bodyPart: BodyPart; bodyweight?: boolean; equipment?: Equipment }): Promise<StoredExercise> {
  const equipment = input.equipment ?? (input.bodyweight ? 'bodyweight' : 'other');
  const rec = { id: crypto.randomUUID(), name: input.name.trim(), bodyPart: input.bodyPart, custom: true, bodyweight: input.bodyweight ?? equipment === 'bodyweight', equipment, deleted: false };
  check(rec);
  return (await saveRecords(ctx, { exercises: [rec as never] })).exercises[0]!;
}

export async function renameExercise(ctx: Ctx, id: string, name: string): Promise<StoredExercise> {
  const cur = await getExercise(ctx.db, id);
  if (!cur) throw new Error('종목을 찾을 수 없어요');
  const next = { ...cur, name: name.trim() };
  check(next);
  return (await saveRecords(ctx, { exercises: [next] })).exercises[0]!;
}

export async function deleteExercise(ctx: Ctx, id: string): Promise<void> {
  const cur = await getExercise(ctx.db, id);
  if (!cur || cur.deleted) return;
  await saveRecords(ctx, { exercises: [{ ...cur, deleted: true }] });
}

export async function restoreExercise(ctx: Ctx, id: string): Promise<void> {
  const cur = await getExercise(ctx.db, id);
  if (!cur || !cur.deleted) return;
  await saveRecords(ctx, { exercises: [{ ...cur, deleted: false }] });
}

/** 종목 메모(0~500자). 공백·줄바꿈은 그대로 둔다 (기능 3, research W5) */
export async function setExerciseMemo(ctx: Ctx, id: string, memo: string): Promise<StoredExercise> {
  const cur = await getExercise(ctx.db, id);
  if (!cur) throw new Error('종목을 찾을 수 없어요');
  const next = { ...cur, memo };
  check(next);
  return (await saveRecords(ctx, { exercises: [next] })).exercises[0]!;
}

/** 좋아요 켜기·끄기 (동기화된다, 기능 5) */
export async function toggleFavorite(ctx: Ctx, id: string): Promise<StoredExercise> {
  const cur = await getExercise(ctx.db, id);
  if (!cur) throw new Error('종목을 찾을 수 없어요');
  return (await saveRecords(ctx, { exercises: [{ ...cur, favorite: !cur.favorite }] })).exercises[0]!;
}
