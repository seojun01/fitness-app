// IndexedDB `fitness` (버전 1). 모든 쓰기는 트랜잭션이 complete 된 뒤에만 resolve 된다 (헌법 II).
import type { Exercise, Routine, Session, Settings } from '../../../shared/model.ts';

export const DB_NAME = 'fitness';
const DB_VERSION = 1;

/** dirty: 1 = 서버에 아직 반영되지 않은 변경 */
export type Stored<T> = T & { dirty: 0 | 1 };
export type StoredExercise = Stored<Exercise>;
export type StoredRoutine = Stored<Routine>;
export type StoredSession = Stored<Session>;
export type StoredSettings = Stored<Settings>;

export const RECORD_STORES = ['exercises', 'routines', 'sessions', 'settings'] as const;
export type RecordStore = (typeof RECORD_STORES)[number];
export const ALL_STORES: string[] = [...RECORD_STORES, 'meta'];

export function openFitnessDb(name: string = DB_NAME): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(name, DB_VERSION);
    open.onupgradeneeded = (ev) => migrate(open.result, ev.oldVersion);
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB 를 열 수 없어요'));
    open.onblocked = () => reject(new Error('다른 탭이 데이터베이스를 쓰고 있어요'));
  });
}

/** 버전별 업그레이드 경로. 스키마를 바꾸면 DB_VERSION 을 올리고 여기에 단계를 추가한다. */
function migrate(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    for (const name of RECORD_STORES) {
      const store = db.createObjectStore(name, { keyPath: 'id' });
      store.createIndex('byDirty', 'dirty'); // 0 | 1 (boolean 은 IndexedDB 키가 될 수 없다)
      if (name === 'sessions') {
        store.createIndex('byStatus', 'status');
        store.createIndex('byEndedAt', 'endedAt'); // 진행 중(null)은 인덱스에서 제외된다
      }
    }
    db.createObjectStore('meta'); // 바깥 키(문자열)
  }
}

/** IDBRequest 를 Promise 로 */
export function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('IndexedDB 요청 실패'));
  });
}

/**
 * 트랜잭션을 열고 fn 을 실행한다. 트랜잭션이 complete 되면 fn 의 결과로 resolve,
 * fn 이 throw 하거나 reject 하면 abort 하고 reject 한다.
 * (fn 안에서 IndexedDB 가 아닌 비동기 작업을 기다리면 트랜잭션이 닫히므로 하지 않는다.)
 */
export function runTx<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, fn: (tx: IDBTransaction) => T | Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let result!: T;
    let settled = false;
    const fail = (e: unknown) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
    let tx: IDBTransaction;
    try {
      tx = db.transaction(stores, mode);
    } catch (e) {
      fail(e);
      return;
    }
    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    tx.onabort = () => fail(tx.error ?? new Error('트랜잭션이 취소되었어요'));
    const abort = (e: unknown) => {
      try {
        tx.abort();
      } catch {
        /* 이미 끝남 */
      }
      fail(e);
    };
    try {
      Promise.resolve(fn(tx)).then((v) => {
        result = v;
      }, abort);
    } catch (e) {
      abort(e);
    }
  });
}

export interface CommitOps {
  exercises?: StoredExercise[];
  routines?: StoredRoutine[];
  sessions?: StoredSession[];
  settings?: StoredSettings[];
  meta?: Record<string, unknown>;
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** 쓰기가 커밋된 뒤 호출된다. 동기화 엔진과 화면이 구독한다. */
export function onStoreChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function notifyStoreChange(): void {
  for (const l of [...listeners]) l();
}

/**
 * 여러 object store 에 대한 쓰기를 한 트랜잭션으로 처리한다. 하나라도 실패하면 전부 취소된다.
 * silent 이면 변경 알림을 보내지 않는다(동기화 엔진 자신의 쓰기).
 */
export async function commit(db: IDBDatabase, ops: CommitOps, opts: { silent?: boolean } = {}): Promise<void> {
  await runTx(db, ALL_STORES, 'readwrite', (tx) => {
    for (const name of RECORD_STORES) {
      const store = tx.objectStore(name);
      for (const rec of ops[name] ?? []) store.put(rec);
    }
    const meta = tx.objectStore('meta');
    for (const [k, v] of Object.entries(ops.meta ?? {})) meta.put(v, k);
  });
  if (!opts.silent) notifyStoreChange();
}

// ── 읽기 ────────────────────────────────────────────────────────────

const read = <T>(db: IDBDatabase, store: string, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
  runTx(db, [store], 'readonly', (tx) => req(fn(tx.objectStore(store))));

export function getRecord<T>(db: IDBDatabase, store: RecordStore, id: string): Promise<T | undefined> {
  return read(db, store, (s) => s.get(id) as IDBRequest<T | undefined>);
}

export function listRecords<T>(db: IDBDatabase, store: RecordStore): Promise<T[]> {
  return read(db, store, (s) => s.getAll() as IDBRequest<T[]>);
}

export function listDirty<T>(db: IDBDatabase, store: RecordStore): Promise<T[]> {
  return read(db, store, (s) => s.index('byDirty').getAll(1) as IDBRequest<T[]>);
}
