// 과거 기록 조회: 목록, 세션 수정·삭제, 종목 이력 (FR-010, FR-011, FR-013)
import { sessionVolume, completedSets, durationSec } from '../../shared/volume.ts';
import type { Ctx } from './context.ts';
import { removeSet, updateSet } from './sessions.ts';
import { req, runTx, type StoredSession } from './store/db.ts';
import { getSession, saveRecords } from './store/records.ts';

export interface HistoryRow {
  id: string;
  routineName: string | null;
  startedAt: string;
  endedAt: string;
  totalVolumeKg: number;
  completedSets: number;
  durationSec: number;
}

/** 완료된(삭제되지 않은) 세션을 최신순으로. endedAt 인덱스를 써서 진행 중 세션은 읽지 않는다 */
export async function listCompletedSessions(db: IDBDatabase): Promise<StoredSession[]> {
  const all = await runTx(db, ['sessions'], 'readonly', (tx) => req(tx.objectStore('sessions').index('byEndedAt').getAll() as IDBRequest<StoredSession[]>));
  return all.filter((s) => s.status === 'completed' && !s.deleted).reverse();
}

export function toRow(s: StoredSession): HistoryRow {
  return {
    id: s.id,
    routineName: s.routineName,
    startedAt: s.startedAt,
    endedAt: s.endedAt!,
    totalVolumeKg: sessionVolume(s),
    completedSets: completedSets(s),
    durationSec: durationSec(s),
  };
}

export async function listHistory(db: IDBDatabase): Promise<HistoryRow[]> {
  return (await listCompletedSessions(db)).map(toRow);
}

export interface ExerciseHistoryItem {
  sessionId: string;
  endedAt: string;
  routineName: string | null;
  sets: { weightKg: number; reps: number }[];
}

/** 그 종목의 완료 세트 기록, 최신 세션 먼저 */
export async function exerciseHistory(db: IDBDatabase, exerciseId: string): Promise<ExerciseHistoryItem[]> {
  const out: ExerciseHistoryItem[] = [];
  for (const s of await listCompletedSessions(db)) {
    const sets = s.entries
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets.filter((x) => x.done && x.weightKg !== null && x.reps !== null).map((x) => ({ weightKg: x.weightKg as number, reps: x.reps as number })));
    if (sets.length > 0) out.push({ sessionId: s.id, endedAt: s.endedAt!, routineName: s.routineName, sets });
  }
  return out;
}

// ── 완료된 세션의 수정·삭제 ──────────────────────────────────────────

/** 완료된 세트의 무게·횟수를 고친다 (값은 계속 유효해야 한다) */
export function updateCompletedSet(ctx: Ctx, sessionId: string, entryId: string, setId: string, patch: { weightKg?: number | null; reps?: number | null }): Promise<StoredSession> {
  return updateSet(ctx, sessionId, entryId, setId, patch);
}

export const removeCompletedSet = removeSet;

export async function deleteSession(ctx: Ctx, id: string): Promise<void> {
  const cur = await getSession(ctx.db, id);
  if (!cur || cur.deleted) return;
  await saveRecords(ctx, { sessions: [{ ...cur, deleted: true }] });
}

export async function restoreSession(ctx: Ctx, id: string): Promise<void> {
  const cur = await getSession(ctx.db, id);
  if (!cur || !cur.deleted) return;
  await saveRecords(ctx, { sessions: [{ ...cur, deleted: false }] });
}
