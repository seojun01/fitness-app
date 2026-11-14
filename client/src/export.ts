// 데이터 내보내기와 전체 삭제 (FR-014, research R16)
import { buildExport, type FitnessExport } from '../../shared/export.ts';
import { SEED_VERSION } from '../../shared/model.ts';
import { SEED_EXERCISES } from '../../shared/seed-exercises.ts';
import type { Ctx } from './context.ts';
import { getSettingsRecord, listAllExercises, listAllGuideNotes, listAllRoutines, listAllSessions, saveRecords } from './store/records.ts';

/** 이 기기의 모든 운동 데이터(삭제 표시 제외)를 내보내기 형식으로 */
export async function exportAllData(db: IDBDatabase, exportedAt: string = new Date().toISOString()): Promise<FitnessExport> {
  const [exercises, routines, sessions, settings, guideNotes] = await Promise.all([listAllExercises(db), listAllRoutines(db), listAllSessions(db), getSettingsRecord(db), listAllGuideNotes(db)]);
  return buildExport({ exercises, routines, sessions, settings: settings ?? null, guideNotes }, exportedAt);
}

type Tombstone = { id: string; deleted: true };
const tomb = (id: string): Tombstone => ({ id, deleted: true });

/**
 * 모든 데이터를 지운다. 루틴·세션·직접 만든 종목·설정은 내용을 비운 툼스톤(id·버전만)이 되어 동기화로 서버와 다른 기기에서도 사라진다.
 * 기본 종목은 앱의 일부라 남기고, 사용자가 고치거나 지운 기본 종목은 기본값으로 되돌려 다른 기기에도 퍼뜨린다.
 */
export async function eraseAllData(ctx: Ctx): Promise<void> {
  const [exercises, routines, sessions, settings, guideNotes] = await Promise.all([listAllExercises(ctx.db), listAllRoutines(ctx.db), listAllSessions(ctx.db), getSettingsRecord(ctx.db), listAllGuideNotes(ctx.db)]);
  const defaults = new Map(SEED_EXERCISES.map((e) => [e.id, e]));
  const exerciseOps = [];
  for (const e of exercises) {
    const def = defaults.get(e.id);
    if (def) {
      if (e.version !== SEED_VERSION) exerciseOps.push({ ...def }); // 고치거나 지운 기본 종목 → 기본값으로 (새 version 으로 stamp 된다)
    } else {
      exerciseOps.push(tomb(e.id));
    }
  }
  await saveRecords(ctx, {
    exercises: exerciseOps as never[],
    routines: routines.map((r) => tomb(r.id)) as never[],
    sessions: sessions.map((s) => tomb(s.id)) as never[],
    settings: (settings ? [tomb('settings')] : []) as never[],
    guideNotes: guideNotes.map((n) => tomb(n.id)) as never[],
  });
}

/** 내보내기 JSON 을 파일로 내려받는다 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
