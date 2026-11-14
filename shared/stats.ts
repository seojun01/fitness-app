// 지난번 대비·종목 기록·루틴 카드 요약 (기능 3, data-model "계산값"). UI 와 분리된 순수 함수 (헌법 IV).
import type { BodyPart, RoutineItem, Session, SessionEntry } from './model.ts';

const r4 = (x: number) => Math.round((x + Number.EPSILON) * 10_000) / 10_000;
/** 통계에 넣는 세션: 완료했고 삭제하지 않았으며 끝난 시각이 있는 세션 */
export const completedSessions = (sessions: Session[]): Session[] => sessions.filter((s) => s.status === 'completed' && !s.deleted && s.endedAt);

export interface Totals {
  volumeKg: number;
  reps: number;
  /** 완료 세트가 있고 그 무게가 모두 0 (맨몸으로 한 기록). 완료 세트가 없으면 false */
  allZero: boolean;
}

function sumSets(entries: SessionEntry[]): Totals {
  let volumeKg = 0;
  let reps = 0;
  let allZero = true;
  let count = 0;
  for (const e of entries) {
    for (const s of e.sets) {
      if (!s.done || s.weightKg === null || s.reps === null) continue;
      volumeKg += s.weightKg * s.reps;
      reps += s.reps;
      count++;
      if (s.weightKg > 0) allZero = false;
    }
  }
  return { volumeKg: r4(volumeKg), reps, allZero: count > 0 && allZero };
}

export const entryTotals = (entry: SessionEntry): Totals => sumSets([entry]);

export interface PreviousTotals extends Totals {
  sessionId: string;
  endedAt: string;
}

/** 이 세션(excludeSessionId)을 뺀, 그 종목을 완료한 가장 최근 세션의 합계 */
export function previousTotals(exerciseId: string, sessions: Session[], excludeSessionId: string): PreviousTotals | null {
  const list = completedSessions(sessions)
    .filter((s) => s.id !== excludeSessionId)
    .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!));
  for (const s of list) {
    const entries = s.entries.filter((e) => e.exerciseId === exerciseId);
    if (!entries.some((e) => e.sets.some((x) => x.done))) continue;
    return { sessionId: s.id, endedAt: s.endedAt!, ...sumSets(entries) };
  }
  return null;
}

export interface Comparison {
  metric: 'volume' | 'reps';
  current: number;
  previous: number | null;
  /** 항상 0 이상. direction 이 방향 */
  diff: number;
  direction: 'up' | 'down' | 'same' | 'first';
}

/** 맨몸 종목이거나 이번·지난번 무게가 모두 0이면 횟수, 아니면 볼륨으로 비교한다 (research W3) */
export function compare(current: Totals, previous: Totals | null, bodyweight: boolean): Comparison {
  // 이번에 아직 완료 세트가 없으면(allZero=false, reps=0) 지난번 기준으로 고른다
  const curZero = current.allZero || current.reps === 0;
  const prevZero = previous ? previous.allZero : current.allZero;
  const metric: Comparison['metric'] = bodyweight || (curZero && prevZero) ? 'reps' : 'volume';
  const pick = (t: Totals) => (metric === 'volume' ? t.volumeKg : t.reps);
  const cur = pick(current);
  if (!previous) return { metric, current: cur, previous: null, diff: 0, direction: 'first' };
  const prev = pick(previous);
  const d = r4(cur - prev);
  return { metric, current: cur, previous: prev, diff: Math.abs(d), direction: d > 0 ? 'up' : d < 0 ? 'down' : 'same' };
}

/** 엡리 공식 추정 1RM. 1회는 무게 그대로, 무게 0 은 0 */
export function estimate1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0) return 0;
  return reps <= 1 ? weightKg : weightKg * (1 + reps / 30);
}

export interface ExerciseRecords {
  best1rmKg: number;
  maxWeightKg: number;
  totalVolumeKg: number;
  maxReps: number;
  totalReps: number;
  /** 최신 세션 2개 */
  recent: { sessionId: string; endedAt: string; sets: { weightKg: number; reps: number }[] }[];
}

export function exerciseRecords(exerciseId: string, sessions: Session[]): ExerciseRecords {
  const out: ExerciseRecords = { best1rmKg: 0, maxWeightKg: 0, totalVolumeKg: 0, maxReps: 0, totalReps: 0, recent: [] };
  const list = completedSessions(sessions).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!));
  let best = 0;
  let volume = 0;
  for (const s of list) {
    const sets = s.entries
      .filter((e) => e.exerciseId === exerciseId)
      .flatMap((e) => e.sets.filter((x) => x.done && x.weightKg !== null && x.reps !== null))
      .map((x) => ({ weightKg: x.weightKg as number, reps: x.reps as number }));
    if (sets.length === 0) continue;
    if (out.recent.length < 2) out.recent.push({ sessionId: s.id, endedAt: s.endedAt!, sets });
    for (const x of sets) {
      best = Math.max(best, estimate1rm(x.weightKg, x.reps));
      out.maxWeightKg = Math.max(out.maxWeightKg, x.weightKg);
      out.maxReps = Math.max(out.maxReps, x.reps);
      out.totalReps += x.reps;
      volume += x.weightKg * x.reps;
    }
  }
  out.best1rmKg = Math.round(best * 10) / 10;
  out.totalVolumeKg = r4(volume);
  return out;
}

/** 그 루틴으로 완료한 세션의 최신 endedAt */
export function lastPerformed(routineId: string, sessions: Session[]): string | null {
  let last: string | null = null;
  for (const s of completedSessions(sessions)) if (s.routineId === routineId && (!last || s.endedAt! > last)) last = s.endedAt!;
  return last;
}

/** 기기 현지 날짜 기준: 오늘·어제·N일 전, 30일을 넘으면 날짜 */
export function relativeDay(iso: string, now: Date): string {
  const d = new Date(iso);
  const day = (x: Date) => Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round((day(now) - day(d)) / 86_400_000);
  if (diff <= 0) return '오늘';
  if (diff === 1) return '어제';
  if (diff <= 30) return `${diff}일 전`;
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 루틴의 부위: 루틴 순서대로, 중복 없이, 삭제·없는 종목은 뺀다 */
export function routineBodyParts(routine: { items: RoutineItem[] }, exercises: Map<string, { bodyPart: BodyPart; deleted: boolean }>): BodyPart[] {
  const out: BodyPart[] = [];
  for (const it of routine.items) {
    const ex = exercises.get(it.exerciseId);
    if (!ex || ex.deleted || out.includes(ex.bodyPart)) continue;
    out.push(ex.bodyPart);
  }
  return out;
}
