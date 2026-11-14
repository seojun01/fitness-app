// 사용자 설정: 무게 단위 (FR-012)
import { REST_DEFAULT, validRestSeconds, type WeightUnit } from '../../shared/model.ts';
import type { Ctx } from './context.ts';
import { getSettingsRecord, saveRecords } from './store/records.ts';

export async function getWeightUnit(db: IDBDatabase): Promise<WeightUnit> {
  const s = await getSettingsRecord(db);
  return s && !s.deleted ? s.weightUnit : 'kg';
}

export async function setWeightUnit(ctx: Ctx, unit: WeightUnit): Promise<void> {
  const cur = await getSettingsRecord(ctx.db);
  await saveRecords(ctx, { settings: [{ ...(cur ?? { id: 'settings' as const }), weightUnit: unit, deleted: false } as never] });
}

/** 기본 휴식 시간(초). 설정이 없으면 60 (기능 3, FR-008) */
export async function getRestSeconds(db: IDBDatabase): Promise<number> {
  const s = await getSettingsRecord(db);
  return s && !s.deleted && validRestSeconds(s.restSeconds) ? s.restSeconds : REST_DEFAULT;
}

export async function setRestSeconds(ctx: Ctx, seconds: number): Promise<void> {
  if (!validRestSeconds(seconds)) return;
  const cur = await getSettingsRecord(ctx.db);
  const base = cur && !cur.deleted ? cur : { id: 'settings' as const, weightUnit: 'kg' as const };
  await saveRecords(ctx, { settings: [{ ...base, restSeconds: seconds, deleted: false } as never] });
}
