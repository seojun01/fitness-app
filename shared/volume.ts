// 세트·세션 볼륨과 요약. UI 와 분리된 순수 함수 (헌법 IV). 완료(done)된 세트만 센다.
import type { Session, SessionEntry, SetEntry } from './model.ts';

/** 부동소수점 오차를 줄이려고 소수 넷째 자리로 맞춘다 */
const r4 = (x: number) => Math.round((x + Number.EPSILON) * 10_000) / 10_000;

export function setVolume(set: SetEntry): number {
  if (!set.done || set.weightKg === null || set.reps === null) return 0;
  return r4(set.weightKg * set.reps);
}

export function entryVolume(entry: SessionEntry): number {
  return r4(entry.sets.reduce((sum, s) => sum + setVolume(s), 0));
}

export function sessionVolume(session: Pick<Session, 'entries'>): number {
  return r4(session.entries.reduce((sum, e) => sum + entryVolume(e), 0));
}

export function completedSets(session: Pick<Session, 'entries'>): number {
  return session.entries.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
}

/** 완료 세션은 endedAt − startedAt, 진행 중에는 nowMs 기준. 음수는 0 */
export function durationSec(session: Pick<Session, 'startedAt' | 'endedAt'>, nowMs: number = Date.now()): number {
  const end = session.endedAt ? Date.parse(session.endedAt) : nowMs;
  return Math.max(0, Math.round((end - Date.parse(session.startedAt)) / 1000));
}

export interface SessionSummary {
  durationSec: number;
  completedSets: number;
  totalVolumeKg: number;
}

export function summarize(session: Session, nowMs: number = Date.now()): SessionSummary {
  return { durationSec: durationSec(session, nowMs), completedSets: completedSets(session), totalVolumeKg: sessionVolume(session) };
}
