// 레코드 저장소의 공용 읽기·쓰기. 도메인 모듈(routines.ts, sessions.ts 등)이 쓴다.
import type { Exercise, GuideNote, Routine, Session, Settings } from '../../../shared/model.ts';
import { SEED_EXERCISES, SEED_SET } from '../../../shared/seed-exercises.ts';
import { SEED_VERSION } from '../../../shared/model.ts';
import type { Ctx } from '../context.ts';
import {
  commit, getRecord, listDirty, listRecords, req, runTx,
  type CommitOps, type StoredExercise, type StoredGuideNote, type StoredRoutine, type StoredSession, type StoredSettings,
} from './db.ts';
import { getMeta } from './meta.ts';

export const getExercise = (db: IDBDatabase, id: string) => getRecord<StoredExercise>(db, 'exercises', id);
export const getRoutine = (db: IDBDatabase, id: string) => getRecord<StoredRoutine>(db, 'routines', id);
export const getSession = (db: IDBDatabase, id: string) => getRecord<StoredSession>(db, 'sessions', id);
export const getSettingsRecord = (db: IDBDatabase) => getRecord<StoredSettings>(db, 'settings', 'settings');
export const getGuideNote = (db: IDBDatabase, id: string) => getRecord<StoredGuideNote>(db, 'guideNotes', id);
export const listAllGuideNotes = (db: IDBDatabase) => listRecords<StoredGuideNote>(db, 'guideNotes');

export const listAllExercises = (db: IDBDatabase) => listRecords<StoredExercise>(db, 'exercises');
export const listAllRoutines = (db: IDBDatabase) => listRecords<StoredRoutine>(db, 'routines');
export const listAllSessions = (db: IDBDatabase) => listRecords<StoredSession>(db, 'sessions');

export const listDirtyExercises = (db: IDBDatabase) => listDirty<StoredExercise>(db, 'exercises');
export const listDirtyRoutines = (db: IDBDatabase) => listDirty<StoredRoutine>(db, 'routines');
export const listDirtySessions = (db: IDBDatabase) => listDirty<StoredSession>(db, 'sessions');
export const listDirtySettings = (db: IDBDatabase) => listDirty<StoredSettings>(db, 'settings');

type SyncStamp = { version: string; updatedBy: string };

/** 저장 직전에 새 version(HLC)과 updatedBy 를 붙이고 dirty 로 표시한다 */
export function stamp<T extends object>(ctx: Ctx, rec: T): T & SyncStamp & { dirty: 1 } {
  return { ...rec, version: ctx.hlc.next(), updatedBy: ctx.deviceId, dirty: 1 };
}

export interface RecordOps {
  exercises?: (Exercise | StoredExercise)[];
  routines?: (Routine | StoredRoutine)[];
  sessions?: (Session | StoredSession)[];
  settings?: (Settings | StoredSettings)[];
  guideNotes?: (GuideNote | StoredGuideNote)[];
}

/** 레코드를 stamp 해서 한 트랜잭션으로 저장한다(HLC 상태 포함). 저장된(stamp 된) 레코드를 돌려준다. */
export async function saveRecords<T extends RecordOps>(ctx: Ctx, ops: T): Promise<{ [K in keyof T]: StoredAll[K & keyof StoredAll][] }> {
  const stamped: CommitOps = {};
  const out: Record<string, unknown[]> = {};
  for (const k of ['exercises', 'routines', 'sessions', 'settings', 'guideNotes'] as const) {
    const list = ops[k];
    if (!list) continue;
    const s = list.map((r) => stamp(ctx, r));
    (stamped as Record<string, unknown>)[k] = s;
    out[k] = s;
  }
  stamped.meta = { hlc: ctx.hlc.state() };
  await commit(ctx.db, stamped);
  return out as never;
}

interface StoredAll {
  exercises: StoredExercise;
  routines: StoredRoutine;
  sessions: StoredSession;
  settings: StoredSettings;
  guideNotes: StoredGuideNote;
}

/**
 * 기본 종목을 넣거나 새 세트로 올린다 (기능 1 research R15, 기능 5 research P4).
 * - 없는 기본 종목을 넣는다(시드 버전, dirty 아님 → 서버로 올리지 않는다).
 * - 시드 버전 그대로인(사용자가 고치지 않은) 기본 종목은 새 정보(장비 등)로 바꾼다.
 * - 사용자가 고치거나 지운 기본 종목은 건드리지 않는다.
 */
export async function ensureSeed(db: IDBDatabase): Promise<void> {
  const set = (await getMeta<number>(db, 'seedSet')) ?? ((await getMeta<boolean>(db, 'seeded')) === true ? 1 : 0);
  if (set >= SEED_SET) return;
  await runTx(db, ['exercises', 'meta'], 'readwrite', async (tx) => {
    const store = tx.objectStore('exercises');
    for (const e of SEED_EXERCISES) {
      const existing = (await req(store.get(e.id))) as StoredExercise | undefined;
      if (!existing || (existing.version === SEED_VERSION && !existing.deleted)) store.put({ ...e, dirty: 0 });
    }
    const meta = tx.objectStore('meta');
    meta.put(true, 'seeded');
    meta.put(SEED_SET, 'seedSet');
  });
}
