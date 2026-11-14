// 세션 도메인: 시작·종목/세트 편집·종료·폐기 (FR-004~008, FR-013)
import { ENTRIES_MAX, SETS_MAX, validateRecord, type Session, type SessionEntry, type SetEntry } from '../../shared/model.ts';
import { parseHlc } from '../../shared/hlc.ts';
import { prefillSets, previousSets } from '../../shared/prefill.ts';
import { completedSets } from '../../shared/volume.ts';
import type { Ctx } from './context.ts';
import { ValidationError, toValidationError } from './errors.ts';
import type { StoredRoutine, StoredSession } from './store/db.ts';
import { getExercise, getSession, listAllSessions, saveRecords } from './store/records.ts';

export class ActiveSessionError extends Error {
  constructor() {
    super('이 기기에 진행 중인 세션이 이미 있어요');
    this.name = 'ActiveSessionError';
  }
}

export class ReadOnlySessionError extends Error {
  constructor() {
    super('다른 기기에서 진행 중인 세션이라 여기서는 고칠 수 없어요');
    this.name = 'ReadOnlySessionError';
  }
}

const newSet = (weightKg: number | null, reps: number | null): SetEntry => ({ setId: crypto.randomUUID(), weightKg, reps, done: false });

function check(session: object): void {
  const { dirty: _dirty, ...plain } = session as Record<string, unknown>;
  const errs = validateRecord('session', { ...plain, version: 'v', updatedBy: 'x' });
  if (errs.length) throw toValidationError(errs);
}

async function persist(ctx: Ctx, session: Session | StoredSession): Promise<StoredSession> {
  check(session);
  return (await saveRecords(ctx, { sessions: [session] })).sessions[0]!;
}

async function load(ctx: Ctx, id: string): Promise<StoredSession> {
  const cur = await getSession(ctx.db, id);
  if (!cur || cur.deleted) throw new Error('세션을 찾을 수 없어요');
  // 진행 중 세션은 시작한 기기에서만 고칠 수 있다 (다른 기기에서는 읽기 전용)
  if (cur.status === 'active' && cur.startedBy !== ctx.deviceId) throw new ReadOnlySessionError();
  return cur;
}

/** 이 기기가 시작한 진행 중 세션 (기기당 최대 1개). 가장 최근에 시작한 것 */
export async function getActiveSession(ctx: Ctx): Promise<StoredSession | undefined> {
  return (await listAllSessions(ctx.db))
    .filter((s) => s.status === 'active' && !s.deleted && s.startedBy === ctx.deviceId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
}

async function historyFor(ctx: Ctx): Promise<Session[]> {
  return listAllSessions(ctx.db);
}

async function buildEntry(ctx: Ctx, exerciseId: string, count: number | null, history: Session[]): Promise<SessionEntry | null> {
  const ex = await getExercise(ctx.db, exerciseId);
  if (!ex || ex.deleted) return null;
  // 목표 세트 수가 없으면(즉석 추가) 직전 기록의 세트 수, 이력이 없으면 1개
  const n = Math.min(SETS_MAX, count ?? Math.max(1, previousSets(exerciseId, history).length));
  return {
    entryId: crypto.randomUUID(),
    exerciseId,
    exerciseName: ex.name,
    sets: prefillSets(exerciseId, history, n).map((v) => newSet(v.weightKg, v.reps)),
  };
}

export async function startSession(ctx: Ctx, routine: StoredRoutine | null): Promise<StoredSession> {
  if (await getActiveSession(ctx)) throw new ActiveSessionError();
  const history = await historyFor(ctx);
  const entries: SessionEntry[] = [];
  for (const item of routine?.items ?? []) {
    const e = await buildEntry(ctx, item.exerciseId, item.targetSets, history);
    if (e) entries.push(e); // 삭제된 종목은 건너뛴다
  }
  const session: Session = {
    id: crypto.randomUUID(),
    status: 'active',
    routineId: routine?.id ?? null,
    routineName: routine?.name ?? null,
    startedAt: ctx.now().toISOString(),
    endedAt: null,
    startedBy: ctx.deviceId,
    entries,
    deleted: false,
    version: '',
    updatedBy: '',
  };
  return persist(ctx, session);
}

async function mutate(ctx: Ctx, id: string, fn: (s: StoredSession) => Session | StoredSession): Promise<StoredSession> {
  return persist(ctx, fn(await load(ctx, id)));
}

const mapEntry = (s: Session, entryId: string, fn: (e: SessionEntry) => SessionEntry): Session => {
  if (!s.entries.some((e) => e.entryId === entryId)) throw new Error('종목을 찾을 수 없어요');
  return { ...s, entries: s.entries.map((e) => (e.entryId === entryId ? fn(e) : e)) };
};

export async function addEntry(ctx: Ctx, sessionId: string, exerciseId: string): Promise<StoredSession> {
  const cur = await load(ctx, sessionId);
  if (cur.entries.length >= ENTRIES_MAX) throw new ValidationError('entries', `종목은 세션당 최대 ${ENTRIES_MAX}개까지 넣을 수 있어요`);
  const entry = await buildEntry(ctx, exerciseId, null, await historyFor(ctx));
  if (!entry) throw new Error('종목을 찾을 수 없어요');
  return persist(ctx, { ...cur, entries: [...cur.entries, entry] });
}

export const removeEntry = (ctx: Ctx, sessionId: string, entryId: string) =>
  mutate(ctx, sessionId, (s) => ({ ...s, entries: s.entries.filter((e) => e.entryId !== entryId) }));

/** 새 세트: 직전 세트의 값을 복사하되 완료가 아니다 */
export function addSet(ctx: Ctx, sessionId: string, entryId: string): Promise<StoredSession> {
  return mutate(ctx, sessionId, (s) =>
    mapEntry(s, entryId, (e) => {
      if (e.sets.length >= SETS_MAX) throw new ValidationError('sets', `세트는 종목당 최대 ${SETS_MAX}개까지 만들 수 있어요`);
      const last = e.sets[e.sets.length - 1];
      return { ...e, sets: [...e.sets, newSet(last?.weightKg ?? null, last?.reps ?? null)] };
    }),
  );
}

export const removeSet = (ctx: Ctx, sessionId: string, entryId: string, setId: string) =>
  mutate(ctx, sessionId, (s) => mapEntry(s, entryId, (e) => ({ ...e, sets: e.sets.filter((x) => x.setId !== setId) })));

/** 마지막 세트를 지운다. 세트가 없으면 그대로 */
export function removeLastSet(ctx: Ctx, sessionId: string, entryId: string): Promise<StoredSession> {
  return mutate(ctx, sessionId, (s) => mapEntry(s, entryId, (e) => ({ ...e, sets: e.sets.slice(0, -1) })));
}

/** 값이 채워진 세트를 모두 완료로 표시한다. 빈 세트는 건너뛰고 개수를 알려 준다 */
export async function completeAllSets(ctx: Ctx, sessionId: string, entryId: string): Promise<{ session: StoredSession; completed: number; skippedEmpty: number }> {
  let completed = 0;
  let skippedEmpty = 0;
  const session = await mutate(ctx, sessionId, (s) =>
    mapEntry(s, entryId, (e) => ({
      ...e,
      sets: e.sets.map((x) => {
        if (x.done) return x;
        if (x.weightKg === null || x.reps === null) {
          skippedEmpty++;
          return x;
        }
        completed++;
        return { ...x, done: true };
      }),
    })),
  );
  return { session, completed, skippedEmpty };
}

export interface SetPatch {
  weightKg?: number | null;
  reps?: number | null;
  done?: boolean;
}

/** 세트를 고친다. 검증에 실패하면(예: 값이 빈 채로 완료) ValidationError 이고 저장소는 바뀌지 않는다 */
export function updateSet(ctx: Ctx, sessionId: string, entryId: string, setId: string, patch: SetPatch): Promise<StoredSession> {
  return mutate(ctx, sessionId, (s) =>
    mapEntry(s, entryId, (e) => {
      if (!e.sets.some((x) => x.setId === setId)) throw new Error('세트를 찾을 수 없어요');
      return { ...e, sets: e.sets.map((x) => (x.setId === setId ? { ...x, ...patch } : x)) };
    }),
  );
}

export type FinishOutcome = { outcome: 'completed' | 'discarded' | 'empty'; session: StoredSession };

/**
 * 세션을 끝낸다. 완료 세트가 하나도 없으면 ifEmpty 에 따라: ask=아무것도 바꾸지 않고 'empty', save=그대로 저장, discard=폐기(툼스톤).
 * 저장할 때는 완료하지 않은 세트와 빈 종목을 정리해 기록에 수행한 세트만 남긴다.
 */
export async function finishSession(ctx: Ctx, id: string, opts: { ifEmpty: 'ask' | 'save' | 'discard' }): Promise<FinishOutcome> {
  const cur = await load(ctx, id);
  if (completedSets(cur) === 0) {
    if (opts.ifEmpty === 'ask') return { outcome: 'empty', session: cur };
    if (opts.ifEmpty === 'discard') {
      await saveRecords(ctx, { sessions: [{ ...cur, deleted: true }] });
      return { outcome: 'discarded', session: (await getSession(ctx.db, id))! };
    }
  }
  const entries = cur.entries.map((e) => ({ ...e, sets: e.sets.filter((x) => x.done) })).filter((e) => e.sets.length > 0 || completedSets(cur) === 0);
  const session = await persist(ctx, { ...cur, status: 'completed', endedAt: ctx.now().toISOString(), entries: completedSets(cur) === 0 ? cur.entries : entries });
  return { outcome: 'completed', session };
}

export async function discardSession(ctx: Ctx, id: string): Promise<void> {
  const cur = await getSession(ctx.db, id);
  if (!cur || cur.deleted) return;
  await saveRecords(ctx, { sessions: [{ ...cur, deleted: true }] });
}

// ── 복원 (US3, research R10) ─────────────────────────────────────────

/** 마지막 활동 후 이 시간이 지난 진행 중 세션은 "이어하기/종료/폐기"를 묻는다 */
export const STALE_AFTER_MS = 12 * 3600_000;

/** 다른 기기가 시작한 진행 중 세션 (읽기 전용으로만 보여 준다) */
export async function listOtherDeviceActive(ctx: Ctx): Promise<StoredSession[]> {
  return (await listAllSessions(ctx.db)).filter((s) => s.status === 'active' && !s.deleted && s.startedBy !== ctx.deviceId);
}

export interface RestoreState {
  active: StoredSession | undefined;
  /** 마지막 활동(version 의 HLC 시각)이 STALE_AFTER_MS 보다 오래됐다 */
  stale: boolean;
}

export async function restoreState(ctx: Ctx): Promise<RestoreState> {
  const active = await getActiveSession(ctx);
  if (!active) return { active: undefined, stale: false };
  const last = parseHlc(active.version)?.wallMs ?? Date.parse(active.startedAt);
  return { active, stale: ctx.now().getTime() - last > STALE_AFTER_MS };
}

/** 오래 방치된 세션 처리: 이어하기(활동으로 간주), 종료(저장), 폐기 */
export async function resolveStale(ctx: Ctx, id: string, choice: 'continue' | 'finish' | 'discard'): Promise<void> {
  if (choice === 'discard') return discardSession(ctx, id);
  if (choice === 'finish') {
    await finishSession(ctx, id, { ifEmpty: 'save' });
    return;
  }
  await mutate(ctx, id, (s) => s); // 새 version 을 발급해 마지막 활동 시각을 갱신한다
}
