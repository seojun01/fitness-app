// 동기화 엔진: pull → push → pull. 항목 단위 LWW(shared/merge.ts)와 서버 순번 커서를 쓴다.
//  - pull 한 레코드의 병합과 cursor 저장은 한 트랜잭션이다 (중간에 실패하면 아무것도 바뀌지 않는다)
//  - push 는 멱등이다 (응답을 못 받았으면 그대로 다시 보낸다)
//  - 서버가 준 cursor 가 저장된 것보다 작으면 서버가 복원된 것이므로 모든 로컬 레코드를 다시 올린다
//  - 시드 종목(SEED_VERSION)은 올리지 않는다 (research R15)
import { merge } from '../../../shared/merge.ts';
import { RECORD_TYPES, SEED_VERSION, type AnyRecord, type RecordType } from '../../../shared/model.ts';
import type { Ctx } from '../context.ts';
import { ALL_STORES, RECORD_STORES, commit, listDirty, onStoreChange, req, runTx, type RecordStore } from '../store/db.ts';
import { getCursor, getMeta } from '../store/meta.ts';

export type SyncState = 'synced' | 'pending' | 'offline' | 'unauthorized';

export interface SyncStatus {
  state: SyncState;
  /** 서버에 아직 반영되지 않은 변경 수 */
  pending: number;
  lastSyncAt: string | null;
  /** 이 기기가 홈서버에 등록되어 있는지 */
  paired: boolean;
  error?: string;
}

export interface SyncEngineOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  pageSize?: number;
  /** 쓰기 후 push 를 미루는 시간 (ms) */
  debounceMs?: number;
  now?: () => Date;
}

export interface SyncEngine {
  syncNow(): Promise<SyncStatus>;
  status(): Promise<SyncStatus>;
  onStatus(cb: (s: SyncStatus) => void): () => void;
  /** 저장소 변경을 구독해 자동으로 push 한다 (앱에서만 호출) */
  start(): void;
  stop(): void;
  /** 쓰기 직후 호출: 짧은 지연 뒤 동기화한다 */
  schedule(): void;
  /** 등록을 마친 기기: paired 로 표시하고 그동안 만든 모든 로컬 데이터를 올릴 대상으로 만든다 */
  markPaired(): Promise<void>;
}

class UnauthorizedError extends Error {}

const STORE_OF: Record<RecordType, RecordStore> = { exercise: 'exercises', routine: 'routines', session: 'sessions', settings: 'settings', guideNote: 'guideNotes' };
type Change = { type: RecordType; record: AnyRecord };
type Page = { changes: Change[]; cursor: number; hasMore: boolean };
type Stored = AnyRecord & { dirty: 0 | 1 };

const stripDirty = <T extends { dirty: unknown }>({ dirty: _d, ...rest }: T) => rest;

export function createSyncEngine(ctx: Ctx, opts: SyncEngineOptions = {}): SyncEngine {
  const { db } = ctx;
  const doFetch: typeof fetch = opts.fetch ?? ((...a) => globalThis.fetch(...a));
  const base = opts.baseUrl ?? '';
  const pageSize = opts.pageSize ?? 1000;
  const debounceMs = opts.debounceMs ?? 300;
  const now = opts.now ?? ctx.now;

  let outcome: 'idle' | 'ok' | 'offline' | 'unauthorized' = 'idle';
  let lastError: string | undefined;
  let running: Promise<SyncStatus> | null = null;
  let again = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<(s: SyncStatus) => void>();

  // ── 상태 ──────────────────────────────────────────────────────────
  async function countDirty(): Promise<number> {
    let n = 0;
    for (const store of RECORD_STORES) n += (await listDirty(db, store)).length;
    return n;
  }

  async function status(): Promise<SyncStatus> {
    const paired = (await getMeta<boolean>(db, 'paired')) === true;
    const pending = await countDirty();
    const lastSyncAt = (await getMeta<string>(db, 'lastSyncAt')) ?? null;
    let state: SyncState;
    if (!paired || outcome === 'unauthorized') state = 'unauthorized';
    else if (outcome === 'offline') state = 'offline';
    else state = pending > 0 ? 'pending' : 'synced';
    const s: SyncStatus = { state, pending, lastSyncAt, paired };
    if (lastError && outcome === 'offline') s.error = lastError;
    return s;
  }
  async function emit(): Promise<SyncStatus> {
    const s = await status();
    for (const l of [...listeners]) l(s);
    return s;
  }

  // ── 네트워크 ──────────────────────────────────────────────────────
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await doFetch(base + path, {
      credentials: 'same-origin',
      ...init,
      headers: { 'X-Fitness-Client': '1', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    if (res.status === 401) throw new UnauthorizedError('unauthorized');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  }

  // ── dirty 표시 ────────────────────────────────────────────────────
  /** 모든 로컬 레코드를 올릴 대상으로 만든다. 시드(SEED_VERSION)는 제외 */
  async function markAllDirty(resetCursor: boolean): Promise<void> {
    await runTx(db, ALL_STORES, 'readwrite', async (tx) => {
      for (const name of RECORD_STORES) {
        const store = tx.objectStore(name);
        for (const r of (await req(store.getAll())) as Stored[]) if (r.dirty !== 1 && r.version !== SEED_VERSION) store.put({ ...r, dirty: 1 });
      }
      if (resetCursor) tx.objectStore('meta').put(0, 'cursor');
    });
  }

  // ── pull ──────────────────────────────────────────────────────────
  /** 한 페이지를 병합해 저장한다. 병합과 cursor 갱신은 한 트랜잭션이다. */
  async function applyPage(page: Page): Promise<void> {
    await runTx(db, ALL_STORES, 'readwrite', async (tx) => {
      const meta = tx.objectStore('meta');
      let maxVersion = '';
      for (const { type, record } of page.changes) {
        if (!(RECORD_TYPES as readonly string[]).includes(type)) continue;
        if (record.version > maxVersion) maxVersion = record.version;
        const store = tx.objectStore(STORE_OF[type]);
        const existing = (await req(store.get(record.id))) as Stored | undefined;
        if (merge(existing, record) === record) store.put({ ...record, dirty: 0 });
      }
      meta.put(page.cursor, 'cursor');
      if (maxVersion) {
        ctx.hlc.receive(maxVersion); // 이후 로컬 변경은 항상 원격 변경보다 나중이다
        meta.put(ctx.hlc.state(), 'hlc');
      }
    });
  }

  async function pullAll(): Promise<void> {
    let since = await getCursor(db);
    for (let guard = 0; guard < 100_000; guard++) {
      const page = await call<Page>(`/api/changes?since=${since}&limit=${pageSize}`);
      if (!page.hasMore && page.cursor < since) {
        await markAllDirty(true); // 서버가 백업에서 복원됨
        since = 0;
        continue;
      }
      await applyPage(page);
      since = page.cursor;
      if (!page.hasMore) return;
    }
    throw new Error('pull 이 끝나지 않아요');
  }

  // ── push ──────────────────────────────────────────────────────────
  async function pushAll(): Promise<number> {
    const items: { type: RecordType; stored: Stored }[] = [];
    for (const type of RECORD_TYPES) for (const stored of await listDirty<Stored>(db, STORE_OF[type])) items.push({ type, stored });
    if (items.length === 0) return 0;
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      await call('/api/changes', { method: 'POST', body: JSON.stringify({ changes: chunk.map((c) => ({ type: c.type, record: stripDirty(c.stored) })) }) });
      await clearDirty(chunk);
    }
    return items.length;
  }

  /** 보낸 시점과 version 이 같은 레코드만 dirty 를 푼다 (보내는 사이 다시 바뀌었으면 dirty 유지) */
  async function clearDirty(sent: { type: RecordType; stored: Stored }[]): Promise<void> {
    await runTx(db, ALL_STORES, 'readwrite', async (tx) => {
      for (const { type, stored } of sent) {
        const store = tx.objectStore(STORE_OF[type]);
        const cur = (await req(store.get(stored.id))) as Stored | undefined;
        if (cur && cur.version === stored.version) store.put({ ...cur, dirty: 0 });
      }
    });
  }

  // ── 한 번의 동기화 ────────────────────────────────────────────────
  async function runOnce(): Promise<void> {
    if ((await getMeta<boolean>(db, 'paired')) !== true) {
      outcome = 'unauthorized'; // 등록하지 않은 기기는 서버에 요청하지 않는다 (로컬로만 쓴다)
      return;
    }
    try {
      await pullAll();
      const pushed = await pushAll();
      if (pushed > 0) await pullAll(); // 내 변경이 반영된 cursor 로 앞당기고, 그사이 다른 기기의 변경도 받는다
      outcome = 'ok';
      lastError = undefined;
      await commit(db, { meta: { lastSyncAt: now().toISOString() } }, { silent: true });
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        outcome = 'unauthorized';
      } else {
        outcome = 'offline';
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  function syncNow(): Promise<SyncStatus> {
    if (running) {
      again = true; // 진행 중인 동기화가 끝난 뒤 한 번 더
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await runOnce();
        } while (again);
      } finally {
        running = null;
      }
      return emit();
    })();
    return running;
  }

  function schedule(): void {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void syncNow();
    }, debounceMs);
  }

  return {
    syncNow,
    status,
    onStatus(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    start() {
      unsubscribe ??= onStoreChange(() => {
        void emit(); // 대기 중인 변경 수가 바뀌었으니 표시를 갱신
        schedule();
      });
    },
    stop() {
      unsubscribe?.();
      unsubscribe = undefined;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
    schedule,
    async markPaired() {
      outcome = 'idle';
      lastError = undefined;
      await markAllDirty(false);
      await commit(db, { meta: { paired: true } }, { silent: true });
      await emit();
    },
  };
}
