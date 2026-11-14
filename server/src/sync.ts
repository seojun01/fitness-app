// 동기화: 변경 반영(push)과 변경 조회(pull). 네 종류의 레코드가 하나의 seq 번호 공간을 쓴다.
import { merge } from '../../shared/merge.ts';
import { validateRecord, type AnyRecord, type RecordType } from '../../shared/model.ts';
import { transaction, type Db } from './db.ts';
import { HttpError } from './http.ts';

export interface Change {
  type: RecordType;
  record: AnyRecord;
}

export const MAX_CHANGES = 500;
export const MAX_PAGE = 1000;

interface Detail {
  type: string;
  id: string;
  field: string;
  rule: string;
}

function validateAll(changes: unknown[]): Detail[] {
  const details: Detail[] = [];
  for (const raw of changes) {
    const c = raw as { type?: unknown; record?: Record<string, unknown> } | null;
    const type = String(c?.type);
    const id = String(c?.record?.id ?? '');
    if (!c || typeof c.record !== 'object' || c.record === null) {
      details.push({ type, id, field: 'record', rule: 'type' });
      continue;
    }
    for (const e of validateRecord(type, c.record)) details.push({ type, id, ...e });
  }
  return details;
}

function lastSeq(db: Db): number {
  const r = db.prepare(`SELECT value FROM server_meta WHERE key = 'last_seq'`).get() as { value: string } | undefined;
  return r ? Number(r.value) : 0;
}

export function currentCursor(db: Db): number {
  return lastSeq(db);
}

/** 변경을 한 트랜잭션으로 반영한다. 하나라도 검증에 실패하면 아무것도 반영하지 않는다. */
export function applyChanges(db: Db, body: unknown): { applied: number; ignored: number; cursor: number } {
  const changes = (body as { changes?: unknown } | null)?.changes;
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > MAX_CHANGES) {
    throw new HttpError(400, 'validation', `changes 는 1~${MAX_CHANGES}개여야 해요`, [{ type: 'request', id: '', field: 'changes', rule: 'count' }]);
  }
  const details = validateAll(changes);
  if (details.length > 0) throw new HttpError(400, 'validation', '올바르지 않은 레코드가 있어요', details);

  return transaction(db, () => {
    let seq = lastSeq(db);
    let applied = 0;
    let ignored = 0;
    for (const { type, record } of changes as Change[]) {
      const row = db.prepare('SELECT version FROM records WHERE type = ? AND id = ?').get(type, record.id) as { version: string } | undefined;
      const existing = row ? { version: row.version } : undefined;
      if (existing && merge(existing, record) !== record) {
        ignored++;
        continue;
      }
      db.prepare(
        `INSERT INTO records (type, id, version, deleted, body, seq) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(type, id) DO UPDATE SET version = excluded.version, deleted = excluded.deleted, body = excluded.body, seq = excluded.seq`,
      ).run(type, record.id, record.version, record.deleted ? 1 : 0, JSON.stringify(record), ++seq);
      applied++;
    }
    if (applied > 0) {
      db.prepare(`INSERT INTO server_meta (key, value) VALUES ('last_seq', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(String(seq));
    }
    return { applied, ignored, cursor: seq };
  });
}

export interface PullResult {
  changes: Change[];
  cursor: number;
  hasMore: boolean;
}

export function pullChanges(db: Db, since: number, limit: number = MAX_PAGE): PullResult {
  if (!Number.isInteger(since) || since < 0) throw new HttpError(400, 'invalid_cursor', 'since 는 0 이상의 정수여야 해요');
  const n = Math.max(1, Math.min(MAX_PAGE, Math.floor(limit) || MAX_PAGE));
  const rows = db.prepare('SELECT type, body, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?').all(since, n + 1) as { type: RecordType; body: string; seq: number }[];
  const hasMore = rows.length > n;
  const page = rows.slice(0, n);
  // 아직 더 있으면 마지막으로 돌려준 seq, 다 줬으면 서버의 최신 seq (서버가 복원돼 줄어들었는지 클라이언트가 알 수 있게)
  const cursor = hasMore ? page[page.length - 1]!.seq : lastSeq(db);
  return { changes: page.map((r) => ({ type: r.type, record: JSON.parse(r.body) as AnyRecord })), cursor, hasMore };
}

/** 툼스톤을 뺀 모든 레코드를 종류별로 (내보내기용) */
export function liveRecords<T extends AnyRecord>(db: Db, type: RecordType): T[] {
  const rows = db.prepare('SELECT body FROM records WHERE type = ? AND deleted = 0 ORDER BY seq').all(type) as { body: string }[];
  return rows.map((r) => JSON.parse(r.body) as T);
}
