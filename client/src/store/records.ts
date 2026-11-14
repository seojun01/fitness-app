// 레코드 저장소의 공용 읽기·쓰기. 도메인 모듈(routines.ts, sessions.ts 등)이 쓴다.
import type { Exercise, Routine, Session, Settings } from '../../../shared/model.ts';
import { SEED_EXERCISES } from '../../../shared/seed-exercises.ts';
import type { Ctx } from '../context.ts';
import {
  commit, getRecord, listDirty, listRecords, req, runTx,
  type CommitOps, type StoredExercise, type StoredRoutine, type StoredSession, type StoredSettings,
} from './db.ts';
import { getMeta } from './meta.ts';

export const getExercise = (db: IDBDatabase, id: string) => getRecord<StoredExercise>(db, 'exercises', id);
export const getRoutine = (db: IDBDatabase, id: string) => getRecord<StoredRoutine>(db, 'routines', id);
export const getSession = (db: IDBDatabase, id: string) => getRecord<StoredSession>(db, 'sessions', id);
export const getSettingsRecord = (db: IDBDatabase) => getRecord<StoredSettings>(db, 'settings', 'settings');

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
}

/** 레코드를 stamp 해서 한 트랜잭션으로 저장한다(HLC 상태 포함). 저장된(stamp 된) 레코드를 돌려준다. */
export async function saveRecords<T extends RecordOps>(ctx: Ctx, ops: T): Promise<{ [K in keyof T]: StoredAll[K & keyof StoredAll][] }> {
  const stamped: CommitOps = {};
  const out: Record<string, unknown[]> = {};
  for (const k of ['exercises', 'routines', 'sessions', 'settings'] as const) {
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
}

/**
 * 첫 실행 때 기본 종목을 넣는다 (research R15). 시드는 항상 지는 버전이고 dirty 가 아니라 서버로 올라가지 않는다.
 * 이미 있는 레코드(예: 먼저 받은 삭제 표시)는 건드리지 않는다.
 */
export async function ensureSeed(db: IDBDatabase): Promise<void> {
  if ((await getMeta<boolean>(db, 'seeded')) === true) return;
  await runTx(db, ['exercises', 'meta'], 'readwrite', async (tx) => {
    const store = tx.objectStore('exercises');
    for (const e of SEED_EXERCISES) {
      const existing = await req(store.get(e.id));
      if (!existing) store.put({ ...e, dirty: 0 });
    }
    tx.objectStore('meta').put(true, 'seeded');
  });
}
