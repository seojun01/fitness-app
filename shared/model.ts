// 도메인 타입과 검증. 서버와 클라이언트가 같은 규칙을 쓴다 (data-model.md).
// erasableSyntaxOnly: enum·namespace 를 쓰지 않는다.
import { isMuscleId, type MuscleId } from './muscles.ts';

export type RecordType = 'exercise' | 'routine' | 'session' | 'settings' | 'guideNote';
export const RECORD_TYPES: readonly RecordType[] = ['exercise', 'routine', 'session', 'settings', 'guideNote'];

export type BodyPart = 'chest' | 'back' | 'shoulders' | 'legs' | 'arms' | 'core' | 'cardio' | 'other';
export const BODY_PARTS: readonly BodyPart[] = ['chest', 'back', 'shoulders', 'legs', 'arms', 'core', 'cardio', 'other'];

export type WeightUnit = 'kg' | 'lb';

/** 모든 동기화 레코드의 공통 필드 */
export interface SyncFields {
  id: string;
  deleted: boolean;
  version: string;
  updatedBy: string;
}

export interface Exercise extends SyncFields {
  name: string;
  bodyPart: BodyPart;
  custom: boolean;
  bodyweight: boolean;
  /** 종목 메모(기구 설정 등). 없으면 빈 메모 (기능 3) */
  memo?: string;
}

export interface RoutineItem {
  exerciseId: string;
  targetSets: number;
}

export interface Routine extends SyncFields {
  name: string;
  items: RoutineItem[];
  createdAt: string;
}

/** 완료(done=true)된 세트는 무게·횟수가 유효해야 한다. 아직 채우지 않은 세트는 null 일 수 있다 (이력이 없는 새 세트) */
export interface SetEntry {
  setId: string;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
}

export interface SessionEntry {
  entryId: string;
  exerciseId: string;
  exerciseName: string;
  sets: SetEntry[];
}

export type SessionStatus = 'active' | 'completed';

export interface Session extends SyncFields {
  status: SessionStatus;
  routineId: string | null;
  routineName: string | null;
  startedAt: string;
  endedAt: string | null;
  startedBy: string;
  entries: SessionEntry[];
}

export interface Settings extends SyncFields {
  weightUnit: WeightUnit;
  /** 기본 휴식 시간(초). 없으면 60 (기능 3) */
  restSeconds?: number;
}

/** 직접 만든 종목의 가이드 글 (기능 2). id 는 종목 id 와 같다 */
export interface GuideNote extends SyncFields {
  cues: string[];
  mistakes: string[];
  primaryMuscles: MuscleId[];
  secondaryMuscles: MuscleId[];
}

export type AnyRecord = Exercise | Routine | Session | Settings | GuideNote;

export const SETTINGS_ID = 'settings';

// ── 한도 (data-model.md, research R12) ───────────────────────────────
export const NAME_MAX = 60;
export const ROUTINE_ITEMS_MAX = 50;
export const TARGET_SETS_MIN = 1;
export const TARGET_SETS_MAX = 20;
export const ENTRIES_MAX = 50;
export const SETS_MAX = 50;
export const WEIGHT_KG_MAX = 1000;
export const REPS_MIN = 1;
export const REPS_MAX = 999;
export const MEMO_MAX = 500;
export const REST_MIN = 15;
export const REST_MAX = 600;
export const REST_STEP = 15;
export const REST_DEFAULT = 60;
export const NOTE_ITEMS_MAX = 10;
export const NOTE_ITEM_MAX = 200;
export const NOTE_MUSCLES_MAX = 6;

/** 기본 종목(시드)의 id 접두어. 시드 id 는 모두 이것으로 시작한다 (shared/tests/seed.test.ts 가 확인) */
export const BUILTIN_ID_PREFIX = '5eed0000-0000-4000-8000-';
export const isBuiltinExerciseId = (id: unknown): boolean => typeof id === 'string' && id.startsWith(BUILTIN_ID_PREFIX);

/** 가장 먼저 지는 고정 버전. 기본 종목(시드)이 쓴다 (research R15) */
export const SEED_VERSION = '000000000000000-000000-seed';

export interface FieldError {
  field: string;
  rule: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;


export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);
export const isIso = (s: unknown): s is string => typeof s === 'string' && ISO_RE.test(s) && !Number.isNaN(Date.parse(s));

/** 코드 포인트 기준 길이 */
export const cpLength = (s: string) => [...s].length;

export function validName(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  const n = cpLength(s.trim());
  return n >= 1 && n <= NAME_MAX;
}

export const validWeightKg = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= WEIGHT_KG_MAX;
export const validReps = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= REPS_MIN && n <= REPS_MAX;

export const validRestSeconds = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= REST_MIN && n <= REST_MAX && n % REST_STEP === 0;

const KEYS: Record<RecordType, readonly string[]> = {
  exercise: ['id', 'name', 'bodyPart', 'custom', 'bodyweight', 'memo', 'deleted', 'version', 'updatedBy'],
  routine: ['id', 'name', 'items', 'createdAt', 'deleted', 'version', 'updatedBy'],
  session: ['id', 'status', 'routineId', 'routineName', 'startedAt', 'endedAt', 'startedBy', 'entries', 'deleted', 'version', 'updatedBy'],
  settings: ['id', 'weightUnit', 'restSeconds', 'deleted', 'version', 'updatedBy'],
  guideNote: ['id', 'cues', 'mistakes', 'primaryMuscles', 'secondaryMuscles', 'deleted', 'version', 'updatedBy'],
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

/** 레코드를 검증한다. 오류가 없으면 빈 배열. 툼스톤(deleted=true)은 공통 필드만 있어도 통과한다. */
export function validateRecord(type: string, record: unknown): FieldError[] {
  const errs: FieldError[] = [];
  const add = (field: string, rule: string) => errs.push({ field, rule });

  if (!(RECORD_TYPES as readonly string[]).includes(type)) return [{ field: 'type', rule: 'unknown' }];
  if (!isObj(record)) return [{ field: 'record', rule: 'type' }];
  const t = type as RecordType;
  const r = record;

  for (const k of Object.keys(r)) if (!KEYS[t].includes(k)) add(k, 'unknown_field');

  // 공통 필드
  if (t === 'settings') {
    if (r.id !== SETTINGS_ID) add('id', 'settings_id');
  } else if (!isUuid(r.id)) add('id', 'uuid');
  else if (t === 'guideNote' && isBuiltinExerciseId(r.id)) add('id', 'builtin_exercise');
  if (typeof r.deleted !== 'boolean') add('deleted', 'type');
  if (typeof r.version !== 'string' || r.version === '') add('version', 'required');
  if (typeof r.updatedBy !== 'string' || r.updatedBy === '') add('updatedBy', 'required');
  if (errs.length > 0 || r.deleted === true) return errs; // 툼스톤은 여기까지만 본다

  if (t === 'exercise') {
    if (!validName(r.name)) add('name', 'length');
    if (!(BODY_PARTS as readonly unknown[]).includes(r.bodyPart)) add('bodyPart', 'enum');
    if (typeof r.custom !== 'boolean') add('custom', 'type');
    if (typeof r.bodyweight !== 'boolean') add('bodyweight', 'type');
    if (r.memo !== undefined && (typeof r.memo !== 'string' || cpLength(r.memo) > MEMO_MAX)) add('memo', 'length');
  } else if (t === 'routine') {
    if (!validName(r.name)) add('name', 'length');
    if (!isIso(r.createdAt)) add('createdAt', 'format');
    if (!Array.isArray(r.items)) add('items', 'type');
    else {
      if (r.items.length > ROUTINE_ITEMS_MAX) add('items', 'max');
      r.items.forEach((it, i) => {
        if (!isObj(it)) return add(`items[${i}]`, 'type');
        for (const k of Object.keys(it)) if (k !== 'exerciseId' && k !== 'targetSets') add(`items[${i}].${k}`, 'unknown_field');
        if (!isUuid(it.exerciseId)) add(`items[${i}].exerciseId`, 'uuid');
        const ts = it.targetSets;
        if (typeof ts !== 'number' || !Number.isInteger(ts) || ts < TARGET_SETS_MIN || ts > TARGET_SETS_MAX) add(`items[${i}].targetSets`, 'range');
      });
    }
  } else if (t === 'session') {
    if (r.status !== 'active' && r.status !== 'completed') add('status', 'enum');
    if (r.routineId !== null && !isUuid(r.routineId)) add('routineId', 'uuid');
    if (r.routineName !== null && (typeof r.routineName !== 'string' || cpLength(r.routineName) > NAME_MAX)) add('routineName', 'length');
    if (!isIso(r.startedAt)) add('startedAt', 'format');
    if (!isUuid(r.startedBy) && (typeof r.startedBy !== 'string' || r.startedBy === '')) add('startedBy', 'required');
    if (r.status === 'completed') {
      if (!isIso(r.endedAt)) add('endedAt', 'required');
      else if (isIso(r.startedAt) && Date.parse(r.endedAt) < Date.parse(r.startedAt)) add('endedAt', 'before_start');
    } else if (r.endedAt !== null) add('endedAt', 'must_be_null');
    if (!Array.isArray(r.entries)) add('entries', 'type');
    else {
      if (r.entries.length > ENTRIES_MAX) add('entries', 'max');
      r.entries.forEach((e, i) => validateEntry(e, i, add));
    }
  } else if (t === 'guideNote') {
    for (const key of ['cues', 'mistakes'] as const) {
      const list = r[key];
      if (!Array.isArray(list)) {
        add(key, 'type');
        continue;
      }
      if (list.length > NOTE_ITEMS_MAX) add(key, 'max');
      list.forEach((item, i) => {
        if (typeof item !== 'string') return add(`${key}[${i}]`, 'type');
        const n = cpLength(item.trim());
        if (n < 1 || n > NOTE_ITEM_MAX) add(`${key}[${i}]`, 'length');
      });
    }
    for (const key of ['primaryMuscles', 'secondaryMuscles'] as const) {
      const list = r[key];
      if (!Array.isArray(list)) {
        add(key, 'type');
        continue;
      }
      if (list.length > NOTE_MUSCLES_MAX) add(key, 'max');
      list.forEach((m, i) => {
        if (!isMuscleId(m)) add(`${key}[${i}]`, 'enum');
      });
      if (new Set(list).size !== list.length) add(key, 'duplicate');
    }
    if (Array.isArray(r.primaryMuscles) && Array.isArray(r.secondaryMuscles) && r.secondaryMuscles.some((m) => (r.primaryMuscles as unknown[]).includes(m))) {
      add('secondaryMuscles', 'overlap');
    }
  } else {
    if (r.weightUnit !== 'kg' && r.weightUnit !== 'lb') add('weightUnit', 'enum');
    if (r.restSeconds !== undefined && !validRestSeconds(r.restSeconds)) add('restSeconds', 'range');
  }
  return errs;
}

function validateEntry(e: unknown, i: number, add: (f: string, r: string) => void): void {
  const p = `entries[${i}]`;
  if (!isObj(e)) return add(p, 'type');
  for (const k of Object.keys(e)) if (!['entryId', 'exerciseId', 'exerciseName', 'sets'].includes(k)) add(`${p}.${k}`, 'unknown_field');
  if (!isUuid(e.entryId)) add(`${p}.entryId`, 'uuid');
  if (!isUuid(e.exerciseId)) add(`${p}.exerciseId`, 'uuid');
  if (typeof e.exerciseName !== 'string' || cpLength(e.exerciseName) > NAME_MAX) add(`${p}.exerciseName`, 'length');
  if (!Array.isArray(e.sets)) return add(`${p}.sets`, 'type');
  if (e.sets.length > SETS_MAX) add(`${p}.sets`, 'max');
  e.sets.forEach((s, j) => {
    const q = `${p}.sets[${j}]`;
    if (!isObj(s)) return add(q, 'type');
    for (const k of Object.keys(s)) if (!['setId', 'weightKg', 'reps', 'done'].includes(k)) add(`${q}.${k}`, 'unknown_field');
    if (!isUuid(s.setId)) add(`${q}.setId`, 'uuid');
    if (typeof s.done !== 'boolean') add(`${q}.done`, 'type');
    const mayBeEmpty = s.done === false; // 아직 확정하지 않은 세트만 비어 있을 수 있다
    if (!(mayBeEmpty && s.weightKg === null) && !validWeightKg(s.weightKg)) add(`${q}.weightKg`, 'range');
    if (!(mayBeEmpty && s.reps === null) && !validReps(s.reps)) add(`${q}.reps`, 'integer_min_1');
  });
}
