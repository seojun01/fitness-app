// 직전 값 미리 채우기 (FR-006, research R13). 값만 돌려준다: 채운 세트는 호출 쪽이 done=false 로 만든다.
import type { Session } from './model.ts';

export interface PrefillValue {
  weightKg: number | null;
  reps: number | null;
}

/** 그 종목을 가장 최근(endedAt 기준)에 완료한 세션의 완료 세트 값. 없으면 빈 배열 */
export function previousSets(exerciseId: string, sessions: Session[]): { weightKg: number; reps: number }[] {
  const candidates = sessions
    .filter((s) => s.status === 'completed' && !s.deleted && s.endedAt)
    .sort((a, b) => b.endedAt!.localeCompare(a.endedAt!));
  for (const s of candidates) {
    for (const entry of s.entries) {
      if (entry.exerciseId !== exerciseId) continue;
      const done = entry.sets.filter((x) => x.done && x.weightKg !== null && x.reps !== null);
      if (done.length > 0) return done.map((x) => ({ weightKg: x.weightKg as number, reps: x.reps as number }));
    }
  }
  return [];
}

/** count 개의 세트 값. 직전보다 많으면 마지막 세트 값을 복사하고, 이력이 없으면 비운다(null) */
export function prefillSets(exerciseId: string, sessions: Session[], count: number): PrefillValue[] {
  const prev = previousSets(exerciseId, sessions);
  return Array.from({ length: count }, (_, i) => {
    const src = prev[Math.min(i, prev.length - 1)];
    return src ? { weightKg: src.weightKg, reps: src.reps } : { weightKg: null, reps: null };
  });
}
