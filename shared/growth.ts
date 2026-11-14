// 성장 차트·통계 계산 (기능 004, data-model.md). UI 와 분리된 순수 함수이며 저장된 기록에서만 계산한다 (헌법 IV).
// 날짜는 세션 시작 시각의 기기 현지 날짜(DayKey = 'YYYY-MM-DD')로 센다. 주는 월요일에 시작한다.
import { BODY_PARTS, type BodyPart, type Session, type SetEntry } from './model.ts';
import { completedSessions, estimate1rm } from './stats.ts';

export type Period = '4w' | '3m' | '1y' | 'all';
export type DayKey = string;
/** 양 끝을 포함한 날짜 범위 */
export interface Range {
  start: DayKey;
  end: DayKey;
  days: number;
}

const r4 = (x: number) => Math.round((x + Number.EPSILON) * 10_000) / 10_000;
const r1 = (x: number) => Math.round((x + Number.EPSILON) * 10) / 10;
const pad = (x: number) => String(x).padStart(2, '0');

// ── 날짜 ──

export const keyOf = (d: Date): DayKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** ISO 시각의 기기 현지 날짜 */
export const dayKey = (iso: string): DayKey => keyOf(new Date(iso));
/** DayKey → 그날 현지 자정 */
export function parseDay(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}
export function addDays(key: DayKey, n: number): DayKey {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return keyOf(d);
}
/** b − a (일) */
export const diffDays = (a: DayKey, b: DayKey): number => Math.round((Date.UTC(...ymd(b)) - Date.UTC(...ymd(a))) / 86_400_000);
function ymd(key: DayKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y!, m! - 1, d!];
}
/** 그 날이 속한 주의 월요일 */
export function mondayOf(key: DayKey): DayKey {
  const wd = (parseDay(key).getDay() + 6) % 7; // 월=0 … 일=6
  return addDays(key, -wd);
}
/** n 달 전·후 같은 날 (없는 날이면 그 달 말일) */
function addMonths(key: DayKey, n: number): DayKey {
  const [y, m, d] = ymd(key);
  const target = new Date(y, m + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d, last));
  return keyOf(target);
}

// ── 기간 ──

/** 오늘을 포함해 거꾸로 센 기간. 'all' 은 첫 기록 날부터이며 기록이 없으면 null */
export function periodRange(period: Period, now: Date, firstDay?: DayKey): Range | null {
  const end = keyOf(now);
  let start: DayKey;
  if (period === '4w') start = addDays(end, -27);
  else if (period === '3m') start = addDays(addMonths(end, -3), 1);
  else if (period === '1y') start = addDays(addMonths(end, -12), 1);
  else {
    if (!firstDay) return null;
    start = firstDay < end ? firstDay : end;
  }
  return { start, end, days: diffDays(start, end) + 1 };
}

/** 바로 앞, 같은 일수 */
export function previousRange(r: Range): Range {
  const end = addDays(r.start, -1);
  return { start: addDays(end, -(r.days - 1)), end, days: r.days };
}

const inRange = (s: Session, r: Range) => {
  const k = dayKey(s.startedAt);
  return k >= r.start && k <= r.end;
};
/** 기간 안 완료 세션 (시작 순) */
export const sessionsIn = (sessions: Session[], r: Range): Session[] =>
  completedSessions(sessions)
    .filter((s) => inRange(s, r))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

/** 완료 세션 중 가장 이른 날 ('all' 기간의 시작) */
export function firstDayOf(sessions: Session[]): DayKey | undefined {
  let first: DayKey | undefined;
  for (const s of completedSessions(sessions)) {
    const k = dayKey(s.startedAt);
    if (!first || k < first) first = k;
  }
  return first;
}

const doneSet = (x: SetEntry): x is SetEntry & { weightKg: number; reps: number } => x.done && x.weightKg !== null && x.reps !== null;
const sessionVolumeKg = (s: Session) => s.entries.reduce((v, e) => v + e.sets.filter(doneSet).reduce((a, x) => a + x.weightKg * x.reps, 0), 0);
const durationSec = (s: Session) => Math.max(0, Math.round((Date.parse(s.endedAt!) - Date.parse(s.startedAt)) / 1000));

// ── 기간 요약 (US2) ──

export interface PeriodSummary {
  sessions: number;
  volumeKg: number;
  durationSec: number;
}

export function summarizeRange(sessions: Session[], r: Range): PeriodSummary {
  const list = sessionsIn(sessions, r);
  return {
    sessions: list.length,
    volumeKg: r4(list.reduce((v, s) => v + sessionVolumeKg(s), 0)),
    durationSec: list.reduce((t, s) => t + durationSec(s), 0),
  };
}

// ── 주별·월별 막대 (US2) ──

export interface Bucket {
  start: DayKey;
  label: string;
  sessions: number;
  volumeKg: number;
}

/** 기간과 겹치는 모든 주(월요일 시작)를 0 포함해 시간순으로. 371일을 넘으면 달별 */
export function buckets(sessions: Session[], r: Range): { unit: 'week' | 'month'; items: Bucket[] } {
  const unit = r.days > 371 ? 'month' : 'week';
  const items: Bucket[] = [];
  const index = new Map<DayKey, Bucket>();
  const keyFor = (day: DayKey) => (unit === 'week' ? mondayOf(day) : `${day.slice(0, 7)}-01`);
  for (let k = keyFor(r.start); k <= r.end; k = unit === 'week' ? addDays(k, 7) : addMonths(k, 1)) {
    const [y, m, d] = ymd(k);
    const b: Bucket = { start: k, label: unit === 'week' ? `${m + 1}/${d}` : `${String(y).slice(2)}.${m + 1}`, sessions: 0, volumeKg: 0 };
    items.push(b);
    index.set(k, b);
  }
  for (const s of sessionsIn(sessions, r)) {
    const b = index.get(keyFor(dayKey(s.startedAt)))!;
    b.sessions++;
    b.volumeKg = r4(b.volumeKg + sessionVolumeKg(s));
  }
  return { unit, items };
}

// ── 부위 비중 (US3) ──

export interface PartShare {
  part: BodyPart;
  sets: number;
  ratio: number;
  volumeKg: number;
  /** 그 부위 종목, 세트 수 많은 순 */
  exerciseIds: string[];
}

export function bodyPartShare(sessions: Session[], exercises: Map<string, { bodyPart: BodyPart }>, r: Range): PartShare[] {
  const parts = new Map<BodyPart, { sets: number; volumeKg: number; byEx: Map<string, number> }>(BODY_PARTS.map((p) => [p, { sets: 0, volumeKg: 0, byEx: new Map() }]));
  let total = 0;
  for (const s of sessionsIn(sessions, r)) {
    for (const e of s.entries) {
      const done = e.sets.filter(doneSet);
      if (done.length === 0) continue;
      const part = parts.get(exercises.get(e.exerciseId)?.bodyPart ?? 'other') ?? parts.get('other')!;
      part.sets += done.length;
      part.volumeKg += done.reduce((v, x) => v + x.weightKg * x.reps, 0);
      part.byEx.set(e.exerciseId, (part.byEx.get(e.exerciseId) ?? 0) + done.length);
      total += done.length;
    }
  }
  return BODY_PARTS.map((part, order) => ({ part, order, ...parts.get(part)! }))
    .sort((a, b) => b.sets - a.sets || a.order - b.order)
    .map(({ part, sets, volumeKg, byEx }) => ({
      part,
      sets,
      ratio: total === 0 ? 0 : sets / total,
      volumeKg: r4(volumeKg),
      exerciseIds: [...byEx.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id),
    }));
}

// ── 종목 추이 (US1) ──

export interface ExercisePoint {
  sessionId: string;
  day: DayKey;
  e1rmKg: number;
  maxWeightKg: number;
  volumeKg: number;
  totalReps: number;
  maxReps: number;
  /** 그 세션의 완료 세트 (주별로 묶은 점이면 빈 배열) */
  sets: { weightKg: number; reps: number }[];
}

function pointOf(s: Session, exerciseId: string): ExercisePoint | null {
  const sets = s.entries
    .filter((e) => e.exerciseId === exerciseId)
    .flatMap((e) => e.sets.filter(doneSet))
    .map((x) => ({ weightKg: x.weightKg, reps: x.reps }));
  if (sets.length === 0) return null;
  return {
    sessionId: s.id,
    day: dayKey(s.startedAt),
    e1rmKg: r1(Math.max(...sets.map((x) => estimate1rm(x.weightKg, x.reps)))),
    maxWeightKg: Math.max(...sets.map((x) => x.weightKg)),
    volumeKg: r4(sets.reduce((v, x) => v + x.weightKg * x.reps, 0)),
    totalReps: sets.reduce((t, x) => t + x.reps, 0),
    maxReps: Math.max(...sets.map((x) => x.reps)),
    sets,
  };
}

/** 기간 안 세션마다 점 하나. maxPoints 를 넘으면 주별 최고값으로 묶는다 (research S5) */
export function exerciseSeries(exerciseId: string, sessions: Session[], r: Range, maxPoints = 60): { points: ExercisePoint[]; grouped: boolean; bodyweightLike: boolean } {
  const points = sessionsIn(sessions, r)
    .map((s) => pointOf(s, exerciseId))
    .filter((p): p is ExercisePoint => p !== null);
  const bodyweightLike = points.length > 0 && points.every((p) => p.maxWeightKg === 0);
  if (points.length <= maxPoints) return { points, grouped: false, bodyweightLike };
  const weeks = new Map<DayKey, ExercisePoint>();
  for (const p of points) {
    const k = mondayOf(p.day);
    const w = weeks.get(k);
    if (!w) {
      weeks.set(k, { ...p, day: k, sets: [] });
      continue;
    }
    w.e1rmKg = Math.max(w.e1rmKg, p.e1rmKg);
    w.maxWeightKg = Math.max(w.maxWeightKg, p.maxWeightKg);
    w.volumeKg = Math.max(w.volumeKg, p.volumeKg);
    w.totalReps = Math.max(w.totalReps, p.totalReps);
    w.maxReps = Math.max(w.maxReps, p.maxReps);
  }
  return { points: [...weeks.values()], grouped: true, bodyweightLike };
}

// ── 개인 최고 기록 (US1) ──

export interface PR {
  /** 무게(kg) 또는 횟수 */
  value: number;
  day: DayKey;
  sessionId: string;
}
export interface PersonalRecords {
  e1rm: PR | null;
  maxWeight: PR | null;
  sessionVolume: PR | null;
  maxReps: PR | null;
  sessionReps: PR | null;
}

/** 전체 기간 기준. 같은 값이면 먼저 달성한 날을 남긴다. 무게 기록이 0이면(맨몸) 무게 지표는 null */
export function personalRecords(exerciseId: string, sessions: Session[]): PersonalRecords {
  const out: PersonalRecords = { e1rm: null, maxWeight: null, sessionVolume: null, maxReps: null, sessionReps: null };
  const bump = (key: keyof PersonalRecords, value: number, p: ExercisePoint) => {
    if (value <= 0) return;
    const cur = out[key];
    if (!cur || value > cur.value) out[key] = { value, day: p.day, sessionId: p.sessionId };
  };
  const list = completedSessions(sessions).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const s of list) {
    const p = pointOf(s, exerciseId);
    if (!p) continue;
    bump('e1rm', p.e1rmKg, p);
    bump('maxWeight', p.maxWeightKg, p);
    bump('sessionVolume', p.volumeKg, p);
    bump('maxReps', p.maxReps, p);
    bump('sessionReps', p.totalReps, p);
  }
  return out;
}

/** 완료 세트가 있는 종목, 최근에 한 순. name 은 가장 최근 기록의 이름 (삭제된 종목 표시용) */
export function exercisesByRecency(sessions: Session[]): { exerciseId: string; name: string; lastDay: DayKey; sessions: number }[] {
  const map = new Map<string, { exerciseId: string; name: string; lastDay: DayKey; last: string; sessions: number }>();
  for (const s of completedSessions(sessions)) {
    const seen = new Set<string>();
    for (const e of s.entries) {
      if (!e.sets.some(doneSet)) continue;
      const cur = map.get(e.exerciseId);
      if (!seen.has(e.exerciseId)) {
        seen.add(e.exerciseId);
        if (!cur) map.set(e.exerciseId, { exerciseId: e.exerciseId, name: e.exerciseName, lastDay: dayKey(s.startedAt), last: s.startedAt, sessions: 1 });
        else cur.sessions++;
      }
      const c = map.get(e.exerciseId)!;
      if (s.startedAt > c.last) Object.assign(c, { name: e.exerciseName, lastDay: dayKey(s.startedAt), last: s.startedAt });
    }
  }
  return [...map.values()].sort((a, b) => b.last.localeCompare(a.last)).map(({ exerciseId, name, lastDay, sessions }) => ({ exerciseId, name, lastDay, sessions }));
}

// ── 달력 (US4) ──

export interface CalendarDay {
  day: DayKey;
  inMonth: boolean;
  /** 그날 시작한 완료 세션, 시작 순 (앞뒤 달 날짜는 빈 배열) */
  sessionIds: string[];
}

export function calendarMonth(sessions: Session[], year: number, month: number): { weeks: CalendarDay[][]; activeDays: number } {
  const first = keyOf(new Date(year, month - 1, 1));
  const lastDate = new Date(year, month, 0).getDate();
  const prefix = `${year}-${pad(month)}-`;
  const byDay = new Map<DayKey, string[]>();
  for (const s of completedSessions(sessions).sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const k = dayKey(s.startedAt);
    if (!k.startsWith(prefix)) continue;
    byDay.set(k, [...(byDay.get(k) ?? []), s.id]);
  }
  const start = mondayOf(first);
  const count = Math.ceil((diffDays(start, first) + lastDate) / 7);
  const weeks: CalendarDay[][] = [];
  for (let w = 0; w < count; w++) {
    const row: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(start, w * 7 + d);
      const inMonth = day.startsWith(prefix);
      row.push({ day, inMonth, sessionIds: inMonth ? (byDay.get(day) ?? []) : [] });
    }
    weeks.push(row);
  }
  return { weeks, activeDays: byDay.size };
}
